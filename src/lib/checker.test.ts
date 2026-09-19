import assert from "node:assert/strict";
import test from "node:test";
import { bootConflicts, runChecker } from "./checker.ts";
import type { FrameworkInstall, InstalledMod } from "./types.ts";

function mod(partial: Partial<InstalledMod> & { id: string; name: string }): InstalledMod {
  return {
    author: "x",
    version: "1",
    latestVersion: "1",
    kind: "pak",
    source: "local",
    sourceId: partial.id,
    target: "server",
    enabled: true,
    loadOrder: 10,
    gameVersions: ["0.1.0"],
    requires: [],
    serverCompatible: true,
    clientCompatible: true,
    description: "",
    category: "World",
    installPath: `mods/${partial.name}.pak`,
    fileCount: 1,
    sizeKb: 10,
    installedAt: "",
    updatedAt: "",
    ...partial,
  };
}

const fw: Record<string, FrameworkInstall> = {
  ue4ss: { id: "ue4ss", name: "UE4SS", clientVersion: "1", serverVersion: "1", latestKnown: "1", assetName: null, updatedAt: null },
  palschema: { id: "palschema", name: "PalSchema", clientVersion: "1", serverVersion: "1", latestKnown: "1", assetName: null, updatedAt: null },
  reshade: { id: "reshade", name: "ReShade", clientVersion: null, serverVersion: null, latestKnown: null, assetName: null, updatedAt: null },
  optiscaler: { id: "optiscaler", name: "OptiScaler", clientVersion: null, serverVersion: null, latestKnown: null, assetName: null, updatedAt: null },
};

test("checker ignores game version pins and flags overlapping paks as start conflicts", () => {
  const mods = [
    mod({ id: "a", name: "One", installPath: "Paks/~mods/Map.pak" }),
    mod({ id: "b", name: "Two", installPath: "Paks/~mods/Map.pak" }),
  ];
  const findings = runChecker({ mods, mode: "server", gameVersion: "1.0.5", frameworks: fw });
  assert.ok(findings.some((f) => f.kind === "conflict"));
  assert.ok(!findings.some((f) => f.kind === "unsupported"));
  const blockers = bootConflicts(mods, { frameworks: fw, mode: "server" });
  assert.equal(blockers.length >= 1, true);
});

test("bootConflicts ignores broken packs so PalServer can still start", () => {
  const mods = [mod({ id: "dead", name: "Dead", kind: "ue4ss", broken: true, fileCount: 0, installPath: "Mods/Dead" })];
  const blockers = bootConflicts(mods, { frameworks: fw });
  assert.equal(blockers.length, 0);
  const findings = runChecker({ mods, mode: "server", gameVersion: "1.0.5", frameworks: fw });
  assert.ok(findings.some((f) => f.kind === "broken" && f.severity === "warn"));
});
