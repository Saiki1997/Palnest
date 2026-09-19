import type { ModFileChoice, ModKind, SearchHit } from "./types.ts";

const LUA_HINT = /scripts\/main\.lua$|\/enabled\.txt$|\/dlls\.txt$|ue4ss\/mods\//i;
const SCHEMA_HINT = /palschema|\/mods\/.+\.json$/i;
const PAK_HINT = /\.pak(\.off)?$/i;

export function kindFolderNote(kind: ModKind) {
  if (kind === "pak") return "PAK → Pal/Content/Paks/~mods";
  if (kind === "palschema") return "PalSchema JSON → ue4ss/Mods/PalSchema/mods";
  if (kind === "ue4ss") return "UE4SS Lua → Pal/Binaries/Win64/ue4ss/Mods";
  if (kind === "reshade") return "ReShade shaders";
  if (kind === "ini") return "INI override";
  return "Framework files";
}

export function guessZipKind(name: string): "pak" | "palschema" | "ue4ss" {
  const n = name.replace(/\\/g, "/").toLowerCase();
  if (n.endsWith(".pak") || n.endsWith(".pak.off")) return "pak";
  if (n.endsWith(".lua")) return "ue4ss";
  if (n.includes("schema") || n.includes("palschema")) return "palschema";
  if (n.includes("pak") || n.endsWith(".pak.zip")) return "pak";
  if (n.includes("lua") || n.includes("ue4ss") || n.includes("script")) return "ue4ss";
  return "ue4ss";
}

export function guessKindFromListing(paths: string[], fallbackName = ""): "pak" | "palschema" | "ue4ss" {
  const n = paths.map((p) => p.replace(/\\/g, "/"));
  let pak = 0;
  let lua = 0;
  let schema = 0;
  for (const p of n) {
    if (PAK_HINT.test(p) && !/pakchunk/i.test(p) && !/global\.pak$/i.test(p)) pak += 1;
    if (LUA_HINT.test(p) || /\.lua$/i.test(p)) lua += 1;
    if (SCHEMA_HINT.test(p)) schema += 1;
  }
  if (pak && pak >= lua && pak >= schema) return "pak";
  if (schema && schema >= lua) return "palschema";
  if (lua) return "ue4ss";
  if (pak) return "pak";
  return guessZipKind(fallbackName || paths[0] || "");
}

/** Local-file-header walk so a dropped zip can be routed without a zip library. */
export function zipEntryNames(bytes: Uint8Array, cap = 400): string[] {
  const names: string[] = [];
  const dec = new TextDecoder();
  let i = 0;
  while (i + 30 < bytes.length && names.length < cap) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x03 && bytes[i + 3] === 0x04) {
      const nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
      const extra = bytes[i + 28] | (bytes[i + 29] << 8);
      const comp =
        (bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24)) >>> 0;
      const start = i + 30;
      const end = Math.min(bytes.length, start + nameLen);
      if (end > start) names.push(dec.decode(bytes.subarray(start, end)));
      i = start + nameLen + extra + comp;
      continue;
    }
    i += 1;
  }
  return names;
}

export function filesForHit(hit: Pick<SearchHit, "name" | "kind" | "files" | "source"> & { sizeKb?: number }): ModFileChoice[] {
  if (hit.files?.length) return hit.files;
  return defaultFilesForKind(hit.name, hit.kind, hit.sizeKb);
}

export function defaultFilesForKind(name: string, kind: ModKind, sizeKb = 256): ModFileChoice[] {
  const slug = name.replace(/[^\w.-]+/g, "_") || "mod";
  if (kind === "ue4ss") {
    return [{ id: "lua", name: `${slug}.zip`, sizeKb, kind: "ue4ss", note: kindFolderNote("ue4ss") }];
  }
  if (kind === "palschema" || kind === "framework") {
    return [{ id: "schema", name: `${slug}.zip`, sizeKb, kind: "palschema", note: kindFolderNote("palschema") }];
  }
  if (kind === "pak") {
    return [{ id: "pak", name: `${slug}_P.pak`, sizeKb: Math.max(sizeKb, 512), kind: "pak", note: kindFolderNote("pak") }];
  }
  return [
    { id: "pak", name: `${slug}_P.pak`, sizeKb: Math.max(sizeKb, 512), kind: "pak", note: kindFolderNote("pak") },
    { id: "lua", name: `${slug}.zip`, sizeKb, kind: "ue4ss", note: kindFolderNote("ue4ss") },
  ];
}

export function fileKindFromName(name: string, listing?: string[]): ModKind {
  if (listing?.length) return guessKindFromListing(listing, name);
  return guessZipKind(name);
}
