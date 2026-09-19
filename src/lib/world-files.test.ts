import assert from "node:assert/strict";
import { test } from "node:test";
import { CURRENT_GAME, supportsGameVersion } from "./catalog.ts";
import { applyParsed, defaultSettings, parseOptionSettings, settingsToIni } from "./ini.ts";
import { encodeLevelMetaSav, encodeWorldOptionSav, inspectSav } from "./sav.ts";
import { buildWorldFilePack, crc32, zipStore } from "./world-pack.ts";

test("PalWorldSettings.ini round-trips quoted strings and nested platforms", () => {
  const settings = defaultSettings().map((s) => {
    if (s.key === "ServerName") return { ...s, value: "Hollow, Isle" };
    if (s.key === "CrossplayPlatforms") return { ...s, value: "Steam,PS5" };
    if (s.key === "ExpRate") return { ...s, value: "2.5" };
    return s;
  });
  const ini = settingsToIni(settings);
  assert.match(ini, /\[\/Script\/Pal.PalGameWorldSettings\]/);
  assert.match(ini, /ServerName="Hollow, Isle"/);
  assert.match(ini, /CrossplayPlatforms=\(Steam,PS5\)/);
  const parsed = parseOptionSettings(ini);
  assert.equal(parsed.ServerName, "Hollow, Isle");
  assert.equal(parsed.CrossplayPlatforms, "Steam,PS5");
  assert.equal(parsed.ExpRate, "2.500000");
  const applied = applyParsed(defaultSettings(), parsed);
  assert.equal(applied.find((s) => s.key === "ServerName")?.value, "Hollow, Isle");
});

test("WorldOption.sav encodes and inspects settings", async () => {
  const settings = defaultSettings().map((s) => {
    if (s.key === "ServerName") return { ...s, value: "Palnest World" };
    if (s.key === "bIsPvP") return { ...s, value: "True" };
    if (s.key === "BaseCampWorkerMaxNum") return { ...s, value: "20" };
    return s;
  });
  const sav = await encodeWorldOptionSav(settings);
  assert.ok(sav.length > 64);
  assert.equal(String.fromCharCode(sav[8], sav[9], sav[10]), "PlZ");
  const report = await inspectSav(sav, "WorldOption.sav");
  assert.equal(report.kind, "worldoption");
  assert.equal(report.settings.ServerName, "Palnest World");
  assert.equal(report.settings.bIsPvP, "True");
  assert.equal(report.settings.BaseCampWorkerMaxNum, "20");
});

test("LevelMeta.sav encodes world name and in-game day", async () => {
  const sav = await encodeLevelMetaSav({
    worldName: "Hollow Isle",
    hostPlayerName: "Mira",
    hostPlayerLevel: 47,
    inGameDay: 118,
  });
  assert.equal(String.fromCharCode(sav[8], sav[9], sav[10]), "PlZ");
  const report = await inspectSav(sav, "LevelMeta.sav");
  assert.equal(report.kind, "meta");
  assert.equal(report.meta?.worldName, "Hollow Isle");
  assert.equal(report.meta?.hostPlayerName, "Mira");
  assert.equal(report.meta?.hostPlayerLevel, 47);
  assert.equal(report.meta?.inGameDay, 118);
});

test("world file pack zips INI, WorldOption.sav, and LevelMeta.sav", async () => {
  const settings = defaultSettings().map((s) => (s.key === "ExpRate" ? { ...s, value: "2" } : s));
  const pack = await buildWorldFilePack({
    settings,
    world: { id: "w1", name: "Hollow Isle", guid: "ABCD", days: 12, sizeMb: 40 },
    optionOverride: true,
    players: [
      {
        id: "p1",
        name: "Mira",
        uid: "1",
        steamId: "1",
        level: 10,
        exp: 0,
        guild: "",
        pals: 0,
        lastSeen: "2026-01-01T00:00:00.000Z",
      },
    ],
    guilds: [],
  });
  const names = pack.files.map((f) => f.name);
  assert.deepEqual(names, [
    "PalWorldSettings.ini",
    "WorldOption.sav",
    "LevelMeta.sav",
    "World.sav.json",
    "README.txt",
  ]);
  assert.match(pack.iniText, /ExpRate=2.000000/);
  assert.equal(pack.zipName, "Hollow-Isle-world-files.zip");
  assert.ok(pack.zip.length > 100);
  const view = new DataView(pack.zip.buffer, pack.zip.byteOffset);
  assert.equal(view.getUint32(0, true), 0x04034b50);

  const option = pack.files.find((f) => f.name === "WorldOption.sav")!;
  const optionReport = await inspectSav(option.data, "WorldOption.sav");
  assert.equal(optionReport.settings.ExpRate, "2.000000");

  const meta = pack.files.find((f) => f.name === "LevelMeta.sav")!;
  const metaReport = await inspectSav(meta.data, "LevelMeta.sav");
  assert.equal(metaReport.meta?.worldName, "Hollow Isle");
  assert.equal(metaReport.meta?.inGameDay, 12);
});

test("zipStore round-trips uncompressed entries", () => {
  const hello = new TextEncoder().encode("hello");
  const zip = zipStore([{ name: "a.txt", data: hello }]);
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.ok(zip.length > hello.length + 30);
});

test("Palworld 1.0+ version matching", () => {
  assert.equal(CURRENT_GAME, "1.0.5");
  assert.equal(supportsGameVersion(["1.0"], "1.0.5"), true);
  assert.equal(supportsGameVersion(["1.0.5"], "1.0.5"), true);
  assert.equal(supportsGameVersion(["1.0+"], "1.0.5"), true);
  assert.equal(supportsGameVersion(["0.7.1", "0.7.2"], "1.0.5"), false);
  assert.equal(supportsGameVersion(["0.6.8"], "1.0.5"), false);
  assert.equal(supportsGameVersion(["1.0.2"], "1.0.5"), false);
  assert.ok(defaultSettings().some((s) => s.key === "bEnableVoiceChat" && s.defaultValue === "False"));
  assert.ok(defaultSettings().some((s) => s.key === "bAllowEnemyCampSpawnNearBaseCamp"));
});
