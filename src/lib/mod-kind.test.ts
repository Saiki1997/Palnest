import assert from "node:assert/strict";
import test from "node:test";
import { fileKindFromName, guessKindFromListing, guessZipKind, zipEntryNames } from "./mod-kind.ts";
import { blameCrash } from "./crash-blame.ts";
import type { InstalledMod } from "./types.ts";

test("listing with a pak goes to ~mods, lua to UE4SS, json to PalSchema", () => {
  assert.equal(guessKindFromListing(["Foo_P.pak"]), "pak");
  assert.equal(guessKindFromListing(["CoolMod/Scripts/main.lua", "CoolMod/enabled.txt"]), "ue4ss");
  assert.equal(guessKindFromListing(["PalSchema/mods/Breeding/config.json"]), "palschema");
  assert.equal(guessZipKind("MapUnlocker_P.pak"), "pak");
  assert.equal(guessZipKind("BreedTweaks.lua"), "ue4ss");
  assert.equal(fileKindFromName("mystery.zip", ["Paks/~mods/X.pak"]), "pak");
});

test("zip local headers yield entry names", () => {
  const name = "Scripts/main.lua";
  const header = new Uint8Array(30 + name.length);
  header[0] = 0x50;
  header[1] = 0x4b;
  header[2] = 0x03;
  header[3] = 0x04;
  header[26] = name.length;
  new TextEncoder().encodeInto(name, header.subarray(30));
  assert.deepEqual(zipEntryNames(header), [name]);
});

test("crash blame reads a UE4SS Mods path from the console", () => {
  const mods = [
    {
      id: "a",
      name: "SafePak",
      kind: "pak",
      enabled: true,
      target: "server",
      installPath: "Paks/~mods/Safe.pak",
      sourceId: "1",
    },
    {
      id: "b",
      name: "BreedTweaks",
      kind: "ue4ss",
      enabled: true,
      target: "server",
      installPath: "ue4ss/Mods/BreedTweaks",
      sourceId: "2",
    },
  ] as InstalledMod[];
  const blame = blameCrash(mods, [
    { text: "LogPal: Display: loading" },
    { text: "[Lua] error in ue4ss/Mods/BreedTweaks/Scripts/main.lua: boom" },
  ]);
  assert.equal(blame?.modId, "b");
  assert.match(blame?.evidence ?? "", /BreedTweaks/);
});
