import assert from "node:assert/strict";
import test from "node:test";
import { instanceExe, overlayInstanceArgs, migrateFleet, nextSlot, portConflicts, portsForSlot, worldBusy } from "./fleet.ts";
import { advanceTunnel, idleTunnel, joinHost, joinIp, tunnelLaunchFlags } from "./tunnels.ts";
import type { LaunchArg, ServerState } from "./types.ts";

function box(partial: Partial<ServerState>): ServerState {
  const slot = partial.slot ?? 0;
  return {
    id: partial.id ?? "a",
    name: partial.name ?? "A",
    description: "",
    running: Boolean(partial.running),
    startedAt: null,
    version: "1.0.5",
    build: "1",
    ...portsForSlot(slot),
    ...partial,
    maxPlayers: partial.maxPlayers ?? 32,
    community: Boolean(partial.community),
    publicIp: partial.publicIp ?? "",
    players: partial.players ?? [],
    versions: [],
    history: ["1.0.5"],
    imported: false,
    importedFrom: "",
    installPath: partial.installPath ?? "",
    worldId: partial.worldId ?? "",
    slot,
    notes: "",
    tunnel: partial.tunnel ?? idleTunnel(portsForSlot(slot).port),
    pid: partial.pid ?? null,
    layout: partial.layout === "shared" ? "shared" : "copy",
    autostart: Boolean(partial.autostart),
    writtenAt: partial.writtenAt ?? null,
    listenAt: partial.listenAt ?? null,
    queryBound: Boolean(partial.queryBound),
  };
}

test("slots never collide game and REST ports", () => {
  const a = portsForSlot(0);
  const b = portsForSlot(1);
  assert.equal(a.port, 8211);
  assert.equal(a.restPort, 8212);
  assert.equal(b.port, 8221);
  assert.equal(b.restPort, 8222);
  assert.notEqual(a.port, b.port);
  assert.notEqual(a.restPort, b.port);
  assert.equal(nextSlot([{ slot: 0 }, { slot: 1 }]), 2);
});

test("running worlds cannot share a UDP port", () => {
  const fleet = [box({ id: "hollow", name: "Hollow", running: true, slot: 0 }), box({ id: "yard", name: "Yard", slot: 1 })];
  const clash = portConflicts(fleet, { id: "yard", ...portsForSlot(0) }, true);
  assert.ok(clash);
  assert.equal(clash?.port, 8211);
  assert.equal(portConflicts(fleet, { id: "yard", ...portsForSlot(1) }, true), null);
});

test("the same world cannot boot twice", () => {
  const fleet = [
    box({ id: "a", running: true, worldId: "w-hollow" }),
    box({ id: "b", worldId: "w-hollow", slot: 1 }),
  ];
  assert.equal(worldBusy(fleet, "w-hollow", "b")?.id, "a");
  assert.equal(worldBusy(fleet, "w-hollow", "a"), undefined);
});

test("old persist without instances becomes a one-world fleet", () => {
  const migrated = migrateFleet({
    server: box({ id: "", name: "Hollow Isle", port: 8211 }) as ServerState,
    worlds: [{ id: "w-hollow", active: true }],
  });
  assert.equal(migrated.instances.length, 1);
  assert.equal(migrated.server.name, "Hollow Isle");
  assert.equal(migrated.server.worldId, "w-hollow");
  assert.ok(migrated.server.id);
});

test("playit claim then start writes publicip for the community list", () => {
  const ctx = { name: "Hollow Isle", slot: 0, port: 8211, queryPort: 27015, provider: "playit" as const };
  let t = idleTunnel(8211);
  t = advanceTunnel(t, "install", ctx);
  assert.equal(t.status, "claim");
  assert.match(t.claimUrl, /^https:\/\/playit\.gg\/claim\//);
  t = advanceTunnel(t, "confirm", ctx);
  t = advanceTunnel(t, "start", ctx);
  assert.equal(t.status, "online");
  assert.ok(t.game?.ip);
  assert.equal(t.game?.host, "hollow-isle.gl.at.ply.gg");
  const flags = tunnelLaunchFlags(t);
  assert.equal(flags.publicIp, t.game?.ip);
  assert.equal(flags.publicPort, t.game?.port);
  const inst = box({ name: "Hollow Isle", tunnel: t, slot: 0 });
  const args: LaunchArg[] = [
    { id: "port", flag: "-port", value: "8211", enabled: true, note: "", category: "network", builtin: true },
    { id: "queryport", flag: "-queryport", value: "27015", enabled: true, note: "", category: "network", builtin: true },
    { id: "players", flag: "-players", value: "32", enabled: true, note: "", category: "network", builtin: true },
    { id: "publiclobby", flag: "-publiclobby", value: "", enabled: false, note: "", category: "community", builtin: true },
  ];
  const overlaid = overlayInstanceArgs(args, inst);
  assert.equal(overlaid.find((a) => a.id === "publicip")?.enabled, true);
  assert.equal(overlaid.find((a) => a.id === "publicport")?.value, String(t.game?.port));
  assert.equal(overlaid.find((a) => a.id === "port")?.value, "8211");
  assert.equal(joinIp(inst), `${t.game?.ip}:${t.game?.port}`);
  assert.equal(joinHost(inst), `${t.game?.host}:${t.game?.port}`);
});

test("portwarp skips claim and maps query as an extra port", () => {
  const ctx = { name: "Build Yard", slot: 1, port: 8221, queryPort: 27016, provider: "portwarp" as const };
  let t = advanceTunnel(idleTunnel(8221), "install", ctx);
  assert.equal(t.status, "offline");
  t = advanceTunnel(t, "start", ctx);
  assert.equal(t.status, "online");
  assert.equal(t.game?.port, 8221);
  assert.equal(t.query?.port, 27016);
  assert.match(t.game?.host ?? "", /portwarp/);
});

test("older worlds keep -queryport; 1.0.4+ respects the launch-arg toggle", () => {
  const args: LaunchArg[] = [
    { id: "queryport", flag: "-queryport", value: "27015", enabled: false, note: "", category: "network", builtin: true },
    { id: "port", flag: "-port", value: "8211", enabled: true, note: "", category: "network", builtin: true },
  ];
  const old = overlayInstanceArgs(args, box({ version: "0.7.3" }));
  assert.equal(old.find((a) => a.id === "queryport")?.enabled, true);
  const modern = overlayInstanceArgs(args, box({ version: "1.0.5" }));
  assert.equal(modern.find((a) => a.id === "queryport")?.enabled, false);
});

test("switching provider keeps the chosen agent, not none", () => {
  const ctx = { name: "Yard", slot: 1, port: 8221, queryPort: 27016, provider: "portwarp" as const };
  const t = advanceTunnel(idleTunnel(8221), "reset", ctx);
  assert.equal(t.provider, "portwarp");
  assert.equal(t.status, "idle");
});

test("instanceExe is PalServer.exe in the PalServer folder", () => {
  const exe = instanceExe(box({ installPath: "C:\\PalServers\\HollowIsle" }), "C:\\PalServers\\Other");
  assert.equal(exe, "C:\\PalServers\\HollowIsle\\PalServer.exe");
});
