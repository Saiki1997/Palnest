import type { AppMode, Finding, FrameworkInstall, InstalledMod } from "./types.ts";
import { findConflicts } from "./ops.ts";

const DUMMY_FRAMEWORKS: Record<string, FrameworkInstall> = {
  ue4ss: { id: "ue4ss", name: "UE4SS", clientVersion: "1", serverVersion: "1", latestKnown: "1", assetName: null, updatedAt: null },
  palschema: {
    id: "palschema",
    name: "PalSchema",
    clientVersion: "1",
    serverVersion: "1",
    latestKnown: "1",
    assetName: null,
    updatedAt: null,
  },
  reshade: { id: "reshade", name: "ReShade", clientVersion: null, serverVersion: null, latestKnown: null, assetName: null, updatedAt: null },
  optiscaler: {
    id: "optiscaler",
    name: "OptiScaler",
    clientVersion: null,
    serverVersion: null,
    latestKnown: null,
    assetName: null,
    updatedAt: null,
  },
};

/** Conflict-first checker. Game-version pins are ignored — Palworld mods rarely list a compatible build. */
export function runChecker(input: {
  mods: InstalledMod[];
  mode: AppMode;
  gameVersion: string;
  frameworks: Record<string, FrameworkInstall>;
}): Finding[] {
  const findings: Finding[] = [];
  const ue4ss =
    input.mode === "client"
      ? Boolean(input.frameworks.ue4ss?.clientVersion)
      : input.mode === "server"
        ? Boolean(input.frameworks.ue4ss?.serverVersion)
        : Boolean(input.frameworks.ue4ss?.clientVersion || input.frameworks.ue4ss?.serverVersion);
  const schema =
    input.mode === "client"
      ? Boolean(input.frameworks.palschema?.clientVersion)
      : input.mode === "server"
        ? Boolean(input.frameworks.palschema?.serverVersion)
        : Boolean(input.frameworks.palschema?.clientVersion || input.frameworks.palschema?.serverVersion);

  const enabled = input.mods.filter((m) => m.enabled);

  for (const hit of findConflicts(input.mods)) {
    findings.push({
      id: `conflict-${hit.id}`,
      severity: "error",
      kind: "conflict",
      title: hit.title,
      detail: `${hit.detail} Palnest still lets PalServer start; overlapping files are the only hard stop.`,
      modId: hit.a,
      fixLabel: "Disable one",
      fixAction: "disable",
    });
  }

  for (const mod of input.mods) {
    if (mod.broken || mod.fileCount <= 0) {
      findings.push({
        id: `broken-${mod.id}`,
        severity: "warn",
        kind: "broken",
        title: `${mod.name} looks broken`,
        detail:
          mod.notes ||
          "Install folder is empty or the main script/pak was not found. PalServer can still start. If it crashes, Palnest will name this pack.",
        modId: mod.id,
        fixLabel: "Disable",
        fixAction: "disable",
      });
    }

    if (mod.enabled && mod.requires.includes("ue4ss") && !ue4ss) {
      findings.push({
        id: `dep-ue4ss-${mod.id}`,
        severity: "error",
        kind: "missing-dep",
        title: `${mod.name} needs UE4SS`,
        detail: "Install UE4SS on the same side this mod is assigned to before starting PalServer.",
        modId: mod.id,
        fixLabel: "Install UE4SS",
        fixAction: "install-ue4ss",
      });
    }

    if (mod.enabled && mod.requires.includes("palschema") && !schema) {
      findings.push({
        id: `dep-schema-${mod.id}`,
        severity: "error",
        kind: "missing-dep",
        title: `${mod.name} needs PalSchema`,
        detail: "PalSchema must sit under ue4ss/Mods before this pack can load.",
        modId: mod.id,
        fixLabel: "Install PalSchema",
        fixAction: "install-palschema",
      });
    }

    if (
      mod.enabled &&
      (input.mode === "server" || input.mode === "both") &&
      (mod.target === "server" || mod.target === "both") &&
      !mod.serverCompatible
    ) {
      findings.push({
        id: `server-${mod.id}`,
        severity: "warn",
        kind: "server-incompatible",
        title: `${mod.name} is a client mod on the server`,
        detail: "It will be ignored or can crash dedicated boot. Keep it on the game client only.",
        modId: mod.id,
        fixLabel: "Disable",
        fixAction: "disable",
      });
    }
  }

  const lua = enabled.filter((m) => m.kind === "ue4ss").length;
  const schemaMods = enabled.filter((m) => m.kind === "palschema").length;
  const paks = enabled.filter((m) => m.kind === "pak").length;

  if (lua > 12) {
    findings.push({
      id: "load-ue4ss",
      severity: "warn",
      kind: "orphan",
      title: `${lua} UE4SS scripts are enabled`,
      detail: "Large Lua stacks slow dedicated boot and fight each other. Split cosmetics onto the client.",
    });
  }
  if (paks > 20) {
    findings.push({
      id: "load-pak",
      severity: "info",
      kind: "orphan",
      title: `${paks} PAK files in ~mods`,
      detail: "Order is filename-based. Prefix with 00_, 10_, 20_ if one pak should win.",
    });
  }
  if (schema && schemaMods === 0) {
    findings.push({
      id: "schema-empty",
      severity: "info",
      kind: "orphan",
      title: "PalSchema is installed with no packs",
      detail: "Harmless, but you can remove the framework until you add a JSON pack.",
    });
  }

  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.kind}:${f.modId ?? f.id}:${f.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const rank = { error: 0, warn: 1, info: 2 };
  return unique.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function bootConflicts(
  mods: InstalledMod[],
  extra?: { frameworks?: Record<string, FrameworkInstall>; mode?: AppMode },
) {
  return runChecker({
    mods,
    mode: extra?.mode === "client" ? "server" : extra?.mode ?? "server",
    gameVersion: "1.0.5",
    frameworks: extra?.frameworks ?? DUMMY_FRAMEWORKS,
  }).filter((f) => f.kind === "conflict");
}
