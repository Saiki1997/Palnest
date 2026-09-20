import assert from "node:assert/strict";
import test from "node:test";
import {
  applyProfile,
  backupDue,
  dueSchedule,
  enabledTxt,
  findConflicts,
  formatBanlist,
  formatJoinMotd,
  guessZipKind,
  modExtractDest,
  pakDiskName,
  parseBanlist,
  parseRestMetrics,
  parseRestPlayers,
  pruneBackups,
  snapshotProfile,
  steamcmdUpdateArgs,
  steamcmdWorkshopArgs,
  DEDICATED_APP,
  WORKSHOP_APP,
  linuxStartScript,
} from "./ops.ts";
import type { InstalledMod } from "./types.ts";

function mod(partial: Partial<InstalledMod> & { id: string; name: string }): InstalledMod {
  return {
    author: "x",
    version: "1",
    latestVersion: "1",
    kind: "palschema",
    source: "local",
    sourceId: partial.id,
    target: "server",
    enabled: true,
    loadOrder: 10,
    gameVersions: ["1.0.5"],
    requires: [],
    serverCompatible: true,
    clientCompatible: true,
    description: "",
    category: "Pals",
    installPath: `mods/${partial.name}`,
    fileCount: 1,
    sizeKb: 10,
    installedAt: "",
    updatedAt: "",
    ...partial,
  };
}

test("steamcmd pins dedicated 2394010 and workshop 1623730", () => {
  const args = steamcmdUpdateArgs("C:\\PalServers\\HollowIsle", "1.0.4");
  assert.ok(args.includes(String(DEDICATED_APP)));
  assert.ok(args.includes("C:\\PalServers\\HollowIsle"));
  assert.ok(args.includes("+download_depot"));
  assert.ok(args.includes("1108401"));
  const latest = steamcmdUpdateArgs("C:\\PalServers\\HollowIsle", "1.0.5");
  assert.ok(latest.includes("+app_update"));
  assert.ok(!latest.includes("+download_depot"));
  const ws = steamcmdWorkshopArgs("C:\\PalServers\\HollowIsle", "3456789");
  assert.ok(ws.includes(String(WORKSHOP_APP)));
  assert.ok(ws.includes("3456789"));
});

test("enable flags write enabled.txt and rename pak.off", () => {
  assert.equal(enabledTxt(true), "1");
  assert.equal(enabledTxt(false), "0");
  assert.equal(pakDiskName("Foo.pak", false), "Foo.pak.off");
  assert.equal(pakDiskName("Foo.pak.off", true), "Foo.pak");
});

test("conflict map catches same file and PalSchema category overlap", () => {
  const mods = [
    mod({ id: "a", name: "One", installPath: "Paks/~mods/Map.pak", kind: "pak" }),
    mod({ id: "b", name: "Two", installPath: "Paks/~mods/Map.pak", kind: "pak" }),
    mod({ id: "c", name: "SchemaA", kind: "palschema", category: "Pals" }),
    mod({ id: "d", name: "SchemaB", kind: "palschema", category: "Pals" }),
  ];
  const hits = findConflicts(mods);
  assert.ok(hits.some((h) => h.title.includes("Same pak")));
  assert.ok(hits.some((h) => h.title.includes("PalSchema")));
  assert.ok(!hits.some((h) => h.title.includes("Broken")));
});

test("profiles snapshot and restore enabled ids", () => {
  const mods = [mod({ id: "a", name: "A", enabled: true }), mod({ id: "b", name: "B", enabled: false })];
  const profile = snapshotProfile("PvE", "", mods, "p1");
  assert.deepEqual(profile.enabledIds, ["a"]);
  const applied = applyProfile(
    mods.map((m) => ({ ...m, enabled: true })),
    profile,
  );
  assert.equal(applied.find((m) => m.id === "a")?.enabled, true);
  assert.equal(applied.find((m) => m.id === "b")?.enabled, false);
});

test("ban list round-trips steam ids", () => {
  const text = formatBanlist([
    { id: "1", steamId: "76561198000001", name: "Griefer", reason: "base wipe", at: "x" },
  ]);
  const parsed = parseBanlist(text);
  assert.equal(parsed[0]?.steamId, "76561198000001");
});

test("schedule fires once per day at HH:MM", () => {
  const now = new Date("2026-09-19T06:00:00.000Z");
  // dueSchedule uses local hours; construct a local date
  const local = new Date(2026, 8, 19, 6, 0, 5);
  assert.equal(dueSchedule("06:00", local, ""), true);
  assert.equal(dueSchedule("06:00", local, "2026-09-19"), false);
  assert.equal(dueSchedule("18:00", local, ""), false);
});

test("backup cadence and prune keep newest", () => {
  assert.equal(backupDue(null, 6), true);
  assert.equal(backupDue(new Date().toISOString(), 6), false);
  const pruned = pruneBackups(
    [
      { createdAt: "2026-09-01T00:00:00.000Z" },
      { createdAt: "2026-09-19T00:00:00.000Z" },
      { createdAt: "2026-09-10T00:00:00.000Z" },
    ],
    2,
  );
  assert.equal(pruned[0].createdAt, "2026-09-19T00:00:00.000Z");
  assert.equal(pruned.length, 2);
});

test("linux start script execs PalServer.sh", () => {
  const sh = linuxStartScript("./PalServer.sh", ["-port=8211", "-publiclobby"], "Hollow");
  assert.match(sh, /PalServer\.sh/);
  assert.match(sh, /-port=8211/);
  assert.match(sh, /Hollow/);
});

test("REST player and metrics parsers", () => {
  const players = parseRestPlayers({
    players: [{ name: "Gridlord", playerId: "7656", level: 42, ping: 18, location_x: 10, location_y: 20 }],
  });
  assert.equal(players[0]?.name, "Gridlord");
  assert.equal(players[0]?.playerId, "7656");
  const metrics = parseRestMetrics({ serverfps: 30, currentplayernum: 4, serverframetime: 33.3 });
  assert.equal(metrics.fps, 30);
  assert.equal(metrics.players, 4);
  assert.equal(guessZipKind("CoolPak.zip"), "pak");
  assert.match(modExtractDest("C:\\PalServer", "pak"), /~mods/);
});

test("join MOTD substitutes player and world", () => {
  assert.equal(formatJoinMotd("Welcome {player} to {world}.", "Gridlord", "Hollow Isle"), "Welcome Gridlord to Hollow Isle.");
  assert.equal(formatJoinMotd("hi {name}", "Ada", "X"), "hi Ada");
  assert.equal(formatJoinMotd("   ", "Ada", "X"), "");
});
