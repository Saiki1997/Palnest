import { CATALOG } from "./catalog.ts";
import type { CatalogMod, ModKind } from "./types.ts";

export type ScanFile = { path: string; size: number; text?: string };

export interface ScanHit {
  slug: string;
  name: string;
  kind: ModKind;
  enabled: boolean;
  broken: boolean;
  installPath: string;
  fileCount: number;
  sizeKb: number;
  catalogId?: string;
  version?: string;
  notes?: string;
}

export interface ScanResult {
  root: string;
  frameworks: {
    ue4ss: string | null;
    palschema: string | null;
    reshade: boolean;
  };
  mods: ScanHit[];
  skipped: string[];
}

const BUNDLED = new Set([
  "bpmodloadermod",
  "cheatmanagerenablermod",
  "consolecommandsmod",
  "consoleenablermod",
  "js",
  "keybinds",
  "linetracemod",
  "shared",
]);

function norm(p: string) {
  return p.replace(/\\/g, "/").replace(/^\.?\//, "");
}

function slug(raw: string) {
  return raw
    .toLowerCase()
    .replace(/\.pak$/i, "")
    .replace(/_p$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function titleFromSlug(s: string) {
  const spaced = s.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()).trim() || s;
}

/** Drop the folder the user picked so Pal/… is at the front when present. */
export function relativeToInstall(raw: string) {
  const p = norm(raw);
  const lower = p.toLowerCase();
  const pal = lower.search(/(^|\/)pal\//);
  if (pal >= 0) return p.slice(lower[pal] === "p" ? pal : pal + 1);
  const ws = lower.search(/workshop\/content\/1623730\//);
  if (ws >= 0) return p.slice(ws);
  const ue = lower.search(/(^|\/)ue4ss\//);
  if (ue >= 0) return `Pal/Binaries/Win64/${p.slice(lower[ue] === "u" ? ue : ue + 1)}`;
  const mods = lower.search(/(^|\/)~mods\//);
  if (mods >= 0) return `Pal/Content/Paks/${p.slice(lower[mods] === "~" ? mods : mods + 1)}`;
  return p;
}

export function matchCatalog(name: string, kind?: ModKind): CatalogMod | undefined {
  const s = slug(name);
  if (!s) return undefined;
  let best: { c: CatalogMod; score: number } | undefined;
  for (const c of CATALOG) {
    if (kind && c.kind !== kind && !(kind === "palschema" && c.kind === "framework")) continue;
    const cn = slug(c.name);
    const cid = slug(c.id.replace(/^(nx|st|cf)-/, ""));
    let score = 0;
    if (c.sourceId && s === slug(c.sourceId)) score = 100;
    else if (s === cn || s === cid) score = 96;
    else if (cn.startsWith(s) || s.startsWith(cn)) score = 82;
    else if (cn.includes(s) || s.includes(cn)) score = Math.min(cn.length, s.length) >= 6 ? 74 : 0;
    if (score && (!best || score > best.score)) best = { c, score };
  }
  return best && best.score >= 74 ? best.c : undefined;
}

function pushGroup(map: Map<string, ScanFile[]>, key: string, file: ScanFile) {
  const list = map.get(key) ?? [];
  list.push(file);
  map.set(key, list);
}

function enabledFrom(files: ScanFile[]) {
  const flag = files.find((f) => /enabled\.txt$/i.test(f.path));
  if (!flag?.text) return true;
  const v = flag.text.trim();
  return v !== "0" && v.toLowerCase() !== "false";
}

function versionFrom(files: ScanFile[], catalog?: CatalogMod) {
  const ver = files.find((f) => /version\.txt$/i.test(f.path) || /ue4ss-version/i.test(f.path));
  const text = ver?.text?.trim();
  if (text) return text.split(/[\r\n]/)[0]!.trim();
  return catalog?.version;
}

function hitFrom(
  name: string,
  kind: ModKind,
  files: ScanFile[],
  installPath: string,
  extra?: Partial<ScanHit>,
): ScanHit {
  const catalog = matchCatalog(name, kind);
  const kindResolved: ModKind = catalog?.kind === "framework" ? "palschema" : catalog?.kind ?? kind;
  const hasLua = files.some((f) => /scripts\/main\.lua$/i.test(f.path));
  const hasJson = files.some((f) => /\.json$/i.test(f.path));
  const hasPak = files.some((f) => /\.pak$/i.test(f.path));
  const broken =
    extra?.broken ??
    (kindResolved === "ue4ss" ? !hasLua : kindResolved === "palschema" ? !hasJson : !hasPak && !hasLua && !hasJson);
  return {
    slug: slug(name),
    name: catalog?.name ?? titleFromSlug(name),
    kind: kindResolved,
    enabled: extra?.enabled ?? enabledFrom(files),
    broken,
    installPath,
    fileCount: files.length,
    sizeKb: Math.max(1, Math.round(files.reduce((n, f) => n + f.size, 0) / 1024)),
    catalogId: catalog?.id,
    version: versionFrom(files, catalog),
    notes: extra?.notes,
  };
}

export function scanListing(root: string, files: ScanFile[]): ScanResult {
  const ue4ssMods = new Map<string, ScanFile[]>();
  const schemaMods = new Map<string, ScanFile[]>();
  const paks: ScanFile[] = [];
  const workshop = new Map<string, ScanFile[]>();
  const skipped: string[] = [];
  let sawUe4ss = false;
  let sawSchema = false;
  let sawReshade = false;
  let ue4ssVersion: string | null = null;
  let schemaVersion: string | null = null;

  for (const raw of files) {
    const rel = relativeToInstall(raw.path);
    const file = { ...raw, path: rel };
    const lower = rel.toLowerCase();

    if (/ue4ss\.dll$/i.test(lower) || /ue4ss-settings\.ini$/i.test(lower) || /\/ue4ss\//i.test(lower)) sawUe4ss = true;
    if (/ue4ss-version/i.test(lower) && file.text) ue4ssVersion = file.text.trim().split(/[\r\n]/)[0] ?? ue4ssVersion;
    if (/palschema/i.test(lower)) sawSchema = true;
    if (/reshade\.ini$/i.test(lower) || /dxgi\.dll$/i.test(lower) && /binaries\/win64/i.test(lower)) sawReshade = true;

    const schemaPack = lower.match(/palschema\/mods\/([^/]+)/i);
    if (schemaPack?.[1] && !schemaPack[1].toLowerCase().endsWith(".json")) {
      pushGroup(schemaMods, schemaPack[1], file);
      continue;
    }
    const schemaJson = lower.match(/palschema\/mods\/([^/]+)\.json$/i);
    if (schemaJson?.[1]) {
      pushGroup(schemaMods, schemaJson[1], file);
      continue;
    }

    const luaMod = lower.match(/ue4ss\/mods\/([^/]+)\//i);
    if (luaMod?.[1]) {
      const name = luaMod[1];
      if (name.toLowerCase() === "palschema") continue;
      if (BUNDLED.has(slug(name))) {
        skipped.push(name);
        continue;
      }
      pushGroup(ue4ssMods, name, file);
      continue;
    }

    if (/\.pak$/i.test(lower) && /\/paks\//i.test(lower) && !/pakchunk/i.test(lower) && !/global\.pak$/i.test(lower)) {
      paks.push(file);
      continue;
    }

    const ws = lower.match(/workshop\/content\/1623730\/(\d+)\//i);
    if (ws?.[1]) pushGroup(workshop, ws[1], file);
  }

  const mods: ScanHit[] = [];
  const seen = new Set<string>();

  for (const [name, group] of ue4ssMods) {
    const hit = hitFrom(name, "ue4ss", group, `${root}/Pal/Binaries/Win64/ue4ss/Mods/${name}`);
    seen.add(hit.catalogId ?? hit.slug);
    mods.push(hit);
  }
  for (const [name, group] of schemaMods) {
    const hit = hitFrom(name, "palschema", group, `${root}/Pal/Binaries/Win64/ue4ss/Mods/PalSchema/mods/${name}`);
    const key = hit.catalogId ?? hit.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    mods.push(hit);
  }
  for (const pak of paks) {
    const base = pak.path.split("/").pop() ?? pak.path;
    const hit = hitFrom(base, "pak", [pak], `${root}/${pak.path}`);
    const key = hit.catalogId ?? hit.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    mods.push(hit);
  }
  for (const [id, group] of workshop) {
    const catalog = CATALOG.find((c) => c.source === "steam" && c.sourceId === id);
    const name = catalog?.name ?? `Workshop ${id}`;
    const kind = catalog?.kind === "framework" ? "palschema" : catalog?.kind ?? "pak";
    const hit = hitFrom(name, kind, group, `${root}/steamapps/workshop/content/1623730/${id}`);
    const key = hit.catalogId ?? hit.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    mods.push({ ...hit, catalogId: catalog?.id ?? hit.catalogId });
  }

  if (sawSchema && !schemaVersion) {
    const pal = CATALOG.find((c) => c.id === "nx-palschema");
    schemaVersion = pal?.version ?? "detected";
  }
  if (sawUe4ss && !ue4ssVersion) ue4ssVersion = "detected";

  mods.sort((a, b) => a.name.localeCompare(b.name));
  return {
    root,
    frameworks: { ue4ss: ue4ssVersion, palschema: schemaVersion, reshade: sawReshade },
    mods,
    skipped: [...new Set(skipped)],
  };
}

export async function filesToListing(files: File[]): Promise<ScanFile[]> {
  const out: ScanFile[] = [];
  for (const file of files) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const row: ScanFile = { path, size: file.size };
    if (file.size < 80_000 && /\.(txt|ini|json|md)$/i.test(file.name)) {
      try {
        row.text = await file.text();
      } catch {
        /* ignore unreadable */
      }
    }
    out.push(row);
  }
  return out;
}

export function findSettingsIni(files: ScanFile[]): string | undefined {
  const hits = files.filter((f) => /palworldsettings\.ini$/i.test(norm(f.path)) && f.text?.trim());
  const preferred =
    hits.find((f) => /windowsserver|linuxserver|windowsonly/i.test(norm(f.path))) ?? hits[0];
  return preferred?.text;
}

export function describeScan(result: ScanResult, stats?: { added: number; updated: number }) {
  const sum = scanSummary(result);
  if (!stats || !result.mods.length) return sum.label;
  return `${sum.label} · ${stats.added} new, ${stats.updated} already listed`;
}

export function scanSummary(result: ScanResult) {
  const ue = result.mods.filter((m) => m.kind === "ue4ss").length;
  const ps = result.mods.filter((m) => m.kind === "palschema").length;
  const pak = result.mods.filter((m) => m.kind === "pak").length;
  const broken = result.mods.filter((m) => m.broken).length;
  const fw = [result.frameworks.ue4ss ? "UE4SS" : null, result.frameworks.palschema ? "PalSchema" : null].filter(Boolean);
  return {
    total: result.mods.length,
    ue,
    ps,
    pak,
    broken,
    frameworks: fw,
    label:
      result.mods.length === 0 && !fw.length
        ? "No mods found in that folder"
        : `${result.mods.length} mod${result.mods.length === 1 ? "" : "s"}${fw.length ? ` · ${fw.join(" + ")}` : ""}`,
  };
}
