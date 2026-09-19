import type { InstallTarget, ModKind } from "./types";

export function modInstallPath(
  kind: ModKind,
  name: string,
  target: InstallTarget,
  roots: { client: string; server: string },
) {
  const root = target === "client" ? roots.client : roots.server;
  const base = root || (target === "client" ? "%CLIENT%" : "%SERVER%");
  const slug = name.replace(/[^\w.-]+/g, "_");
  switch (kind) {
    case "ue4ss":
      return `${base}/Pal/Binaries/Win64/ue4ss/Mods/${slug}`;
    case "palschema":
      return `${base}/Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/${slug}`;
    case "pak":
      return `${base}/Pal/Content/Paks/~mods/${slug}.pak`;
    case "ini":
      return `${base}/Pal/Saved/Config/WindowsServer/PalWorldSettings.ini`;
    case "reshade":
      return `${base}/Pal/Binaries/Win64/reshade-shaders`;
    case "framework":
      return `${base}/Pal/Binaries/Win64`;
    default:
      return `${base}/Mods/${slug}`;
  }
}

export function kindLabel(kind: ModKind) {
  switch (kind) {
    case "ue4ss":
      return "UE4SS";
    case "palschema":
      return "PalSchema";
    case "pak":
      return "PAK";
    case "ini":
      return "INI";
    case "reshade":
      return "ReShade";
    case "framework":
      return "Framework";
  }
}

export function sourceLabel(source: string) {
  switch (source) {
    case "nexus":
      return "Nexus";
    case "steam":
      return "Steam";
    case "curseforge":
      return "CurseForge";
    case "github":
      return "GitHub";
    default:
      return "Local";
  }
}
