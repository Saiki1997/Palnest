import assert from "node:assert/strict";
import test from "node:test";
import { findSettingsIni, matchCatalog, relativeToInstall, scanListing, scanSummary } from "./scan.ts";

const tree = [
  "Pal/Binaries/Win64/UE4SS.dll",
  "Pal/Binaries/Win64/UE4SS-settings.ini",
  "Pal/Binaries/Win64/ue4ss/UE4SS-VERSION.txt",
  "Pal/Binaries/Win64/ue4ss/Mods/ConsoleEnablerMod/Scripts/main.lua",
  "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/Scripts/main.lua",
  "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/BetterPalbox/config.json",
  "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/ConfigurableStackSizes/items.json",
  "Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/BaseCampLimits/base.json",
  "Pal/Binaries/Win64/ue4ss/Mods/DenAdminCommands/Scripts/main.lua",
  "Pal/Binaries/Win64/ue4ss/Mods/GraveCache/Scripts/main.lua",
  "Pal/Binaries/Win64/ue4ss/Mods/OldWorldMinimap/enabled.txt",
  "Pal/Content/Paks/~mods/MapRevealer_P.pak",
  "Pal/Content/Paks/~mods/LeanWorldLODs.pak",
].map((path) => ({
  path,
  size: path.endsWith(".pak") ? 4_000_000 : 1200,
  text: path.endsWith("UE4SS-VERSION.txt")
    ? "2281fa31"
    : path.endsWith("OldWorldMinimap/enabled.txt")
      ? "1"
      : undefined,
}));

test("relativeToInstall strips the picked folder name", () => {
  assert.equal(
    relativeToInstall("HollowIsle/Pal/Binaries/Win64/ue4ss/Mods/Foo/Scripts/main.lua"),
    "Pal/Binaries/Win64/ue4ss/Mods/Foo/Scripts/main.lua",
  );
  assert.equal(relativeToInstall("Pal/Content/Paks/~mods/A.pak"), "Pal/Content/Paks/~mods/A.pak");
});

test("scanListing matches catalog packs and skips bundled UE4SS", () => {
  const result = scanListing("C:\\PalServers\\HollowIsle", tree);
  const names = result.mods.map((m) => m.name);
  assert.equal(result.frameworks.ue4ss, "2281fa31");
  assert.ok(result.frameworks.palschema);
  assert.ok(names.includes("Better Palbox"));
  assert.ok(names.includes("Configurable Stack Sizes"));
  assert.ok(names.includes("Base Camp Limits"));
  assert.ok(names.includes("Den Admin Commands"));
  assert.ok(names.includes("Grave Cache"));
  assert.ok(names.includes("Map Revealer"));
  assert.ok(names.includes("Lean World LODs"));
  assert.equal(names.some((n) => /console enabler/i.test(n)), false);
  assert.equal(result.mods.find((m) => m.name === "Old World Minimap")?.broken, true);
  assert.equal(scanSummary(result).total, result.mods.length);
});

test("matchCatalog maps workshop ids and aliases", () => {
  assert.equal(matchCatalog("3488211901")?.id, "st-restskin");
  assert.equal(matchCatalog("BetterPalbox", "palschema")?.id, "nx-betterpalbox");
  assert.equal(matchCatalog("MapRevealer_P", "pak")?.id, "nx-mapunlock");
});

test("disabled.lua mods stay listed but off", () => {
  const result = scanListing("D:\\Palworld", [
    { path: "Pal/Binaries/Win64/ue4ss/Mods/RecallParty/Scripts/main.lua", size: 800 },
    { path: "Pal/Binaries/Win64/ue4ss/Mods/RecallParty/enabled.txt", size: 1, text: "0" },
  ]);
  assert.equal(result.mods[0]?.name, "Recall Party");
  assert.equal(result.mods[0]?.enabled, false);
  assert.equal(result.mods[0]?.broken, false);
});

test("scanListing accepts a webkitdirectory listing with the picked folder prefix", () => {
  const files = tree.map((f) => ({ ...f, path: `HollowIsle/${f.path}` }));
  const result = scanListing("C:\\PalServers\\HollowIsle", files);
  assert.ok(result.mods.some((m) => m.name === "Better Palbox"));
  assert.ok(result.mods.some((m) => m.name === "Map Revealer"));
  assert.equal(result.frameworks.ue4ss, "2281fa31");
});

test("findSettingsIni prefers the dedicated WindowsServer copy", () => {
  const text = 'OptionSettings=(ServerName="Hollow Isle")';
  const found = findSettingsIni([
    { path: "HollowIsle/Pal/Saved/Config/WindowsServer/PalWorldSettings.ini", size: 120, text },
    { path: "readme.ini", size: 10, text: "nope" },
  ]);
  assert.equal(found, text);
});