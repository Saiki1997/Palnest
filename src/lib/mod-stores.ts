import { CATALOG, catalogToHit, searchCatalog } from "./catalog.ts";
import { fileKindFromName, filesForHit } from "./mod-kind.ts";
import { NEXUS_CATEGORIES, normalizeCategory, storeUrl, stripHtml } from "./mod-meta.ts";
import { parseModQuery } from "./mod-query.ts";
import type {
  DiscoverCategory,
  DiscoverPeriod,
  DiscoverSort,
  DiscoverSource,
  ModFileChoice,
  ModSource,
  SearchHit,
} from "./types";

const NEXUS_HEADERS = (key: string) => ({
  apikey: key,
  Accept: "application/json",
  "User-Agent": "Palnest/3.1.0",
  "Application-Name": "Palnest",
  "Application-Version": "3.1.0",
});

const CURSE_GAME_ID = 85196;
const STEAM_APP_ID = "1623730";

function storeFetch(url: string | URL, init: RequestInit = {}, ms = 10000) {
  return fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(ms) });
}

function isoFromUnix(n?: number) {
  if (!n) return new Date().toISOString();
  const ms = n > 1e12 ? n : n * 1000;
  return new Date(ms).toISOString();
}

async function poolMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R | null>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const val = await fn(items[idx]);
      if (val) out.push(val);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) || 1 }, () => worker()));
  return out;
}

export function mergeHits(primary: SearchHit[], extra: SearchHit[]): SearchHit[] {
  const out = [...primary];
  for (const hit of extra) {
    const i = out.findIndex(
      (h) =>
        h.id === hit.id ||
        (h.source === hit.source && String(h.sourceId) === String(hit.sourceId) && Boolean(h.sourceId)),
    );
    if (i >= 0) {
      out[i] = {
        ...out[i],
        ...hit,
        id: out[i].id,
        files: hit.files?.length ? hit.files : out[i].files,
        image: hit.image || out[i].image,
        body: hit.body || out[i].body,
      };
    } else out.push(hit);
  }
  return out;
}

type NexusModJson = {
  mod_id?: number;
  uid?: number;
  name?: string;
  summary?: string;
  description?: string;
  author?: string;
  uploaded_by?: string;
  version?: string;
  picture_url?: string;
  endorsement_count?: number;
  unique_downloads?: number;
  mod_downloads?: number;
  updated_time?: string;
  created_time?: string;
  updated_timestamp?: number;
  created_timestamp?: number;
  category_id?: number;
  domain_name?: string;
  contains_adult_content?: boolean;
};

type NexusFileJson = {
  file_id: number;
  name?: string;
  file_name?: string;
  version?: string;
  category_name?: string;
  size?: number;
  size_kb?: number;
  size_in_bytes?: number;
  description?: string;
  uploaded_time?: string;
  uploaded_timestamp?: number;
  is_primary?: boolean;
  mod_version?: string;
};

let nexusCategoryMap: Record<number, string> | null = null;

export async function nexusGameMeta(key: string): Promise<{ categories: DiscoverCategory[]; mods: number }> {
  const res = await storeFetch("https://api.nexusmods.com/v1/games/palworld.json", { headers: NEXUS_HEADERS(key) });
  if (!res.ok) return { categories: [], mods: 0 };
  const json = (await res.json()) as {
    mods?: number;
    categories?: Array<{ category_id: number; name: string }>;
  };
  nexusCategoryMap = {};
  const categories: DiscoverCategory[] = [];
  for (const c of json.categories ?? []) {
    const name = normalizeCategory(c.name);
    nexusCategoryMap[c.category_id] = name;
    const existing = categories.find((x) => x.name === name);
    if (existing) existing.count += 0;
    else categories.push({ name, count: 0, id: String(c.category_id) });
  }
  return { categories, mods: json.mods ?? 0 };
}

function nexusCategoryName(id?: number) {
  if (!id || !nexusCategoryMap) return undefined;
  return nexusCategoryMap[id];
}

function hitFromNexus(m: NexusModJson): SearchHit {
  const sourceId = String(m.mod_id ?? "");
  const published = m.created_time || (m.created_timestamp ? isoFromUnix(m.created_timestamp) : undefined);
  const updated = m.updated_time || (m.updated_timestamp ? isoFromUnix(m.updated_timestamp) : published) || new Date().toISOString();
  const category = normalizeCategory(nexusCategoryName(m.category_id));
  const kind = fileKindFromName(m.name || "");
  return {
    id: `nx-live-${sourceId}`,
    name: m.name || `Nexus ${sourceId}`,
    author: m.author || m.uploaded_by || "Nexus",
    version: m.version || "—",
    source: "nexus",
    sourceId,
    url: storeUrl("nexus", sourceId),
    downloads: m.mod_downloads ?? m.unique_downloads ?? 0,
    uniqueDownloads: m.unique_downloads,
    description: stripHtml(m.summary || m.description || "Nexus Mods Palworld pack.").slice(0, 400),
    body: (m.description || m.summary || "").slice(0, 20000),
    kind: kind === "ini" || kind === "framework" ? "pak" : kind,
    updatedAt: updated,
    publishedAt: published || updated,
    serverCompatible: true,
    gameVersions: [],
    requires: [],
    endorsements: m.endorsement_count,
    image: m.picture_url,
    category,
    sizeKb: 0,
  };
}

export async function nexusMod(key: string, id: string): Promise<SearchHit | null> {
  const res = await storeFetch(`https://api.nexusmods.com/v1/games/palworld/mods/${id}.json`, { headers: NEXUS_HEADERS(key) });
  if (!res.ok) return null;
  const m = (await res.json()) as NexusModJson;
  if (!m?.mod_id && !m?.name) return null;
  return hitFromNexus({ ...m, mod_id: m.mod_id ?? Number(id) });
}

export async function nexusFiles(key: string, id: string): Promise<ModFileChoice[]> {
  const res = await storeFetch(`https://api.nexusmods.com/v1/games/palworld/mods/${id}/files.json`, {
    headers: NEXUS_HEADERS(key),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { files?: NexusFileJson[] };
  return (json.files ?? [])
    .filter((f) => {
      const cat = (f.category_name || "").toUpperCase();
      return cat !== "ARCHIVED" && cat !== "OLD" && cat !== "DELETED";
    })
    .map((f) => {
      const fname = f.file_name || f.name || `file-${f.file_id}`;
      const kind = fileKindFromName(fname);
      const sizeKb = Math.max(0, Math.round(f.size_kb || (f.size_in_bytes || f.size || 0) / 1024));
      return {
        id: String(f.file_id),
        name: fname,
        sizeKb,
        kind,
        note: stripHtml(f.description || "") || `${(f.category_name || "MAIN").toLowerCase()} · ${kind}`,
        version: f.mod_version || f.version,
        category: (f.category_name || "MAIN").toUpperCase(),
        uploadedAt: f.uploaded_time || (f.uploaded_timestamp ? isoFromUnix(f.uploaded_timestamp) : undefined),
        primary: Boolean(f.is_primary),
      } satisfies ModFileChoice;
    });
}

async function nexusFeed(key: string, path: string): Promise<SearchHit[]> {
  const res = await storeFetch(`https://api.nexusmods.com/v1/games/palworld/mods/${path}`, { headers: NEXUS_HEADERS(key) });
  if (!res.ok) return [];
  const json = (await res.json()) as NexusModJson[];
  return (Array.isArray(json) ? json : []).filter((m) => m.mod_id).map(hitFromNexus);
}

async function nexusUpdatedIds(key: string, period: "1d" | "1w" | "1m"): Promise<string[]> {
  const res = await storeFetch(`https://api.nexusmods.com/v1/games/palworld/mods/updated.json?period=${period}`, {
    headers: NEXUS_HEADERS(key),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as Array<{ mod_id: number }>;
  return (json ?? []).map((r) => String(r.mod_id)).filter(Boolean);
}

export async function nexusBrowse(
  key: string,
  query: string,
  period: DiscoverPeriod,
): Promise<{ hits: SearchHit[]; categories: DiscoverCategory[]; total: number; note: string }> {
  const meta = await nexusGameMeta(key).catch(() => ({ categories: [] as DiscoverCategory[], mods: 0 }));
  const parsed = parseModQuery(query);
  if (parsed.sourceId && (!parsed.source || parsed.source === "nexus")) {
    const hit = await nexusMod(key, parsed.sourceId);
    return {
      hits: hit ? [hit] : [],
      categories: meta.categories,
      total: hit ? 1 : 0,
      note: hit ? `Nexus mod ${parsed.sourceId}.` : "Nexus id not found.",
    };
  }

  const nexusPeriod: "1d" | "1w" | "1m" = period === "1d" ? "1d" : period === "7d" ? "1w" : period === "all" ? "1m" : "1m";
  const [added, updated, trending, ids] = await Promise.all([
    nexusFeed(key, "latest_added.json"),
    nexusFeed(key, "latest_updated.json"),
    nexusFeed(key, "trending.json"),
    nexusUpdatedIds(key, nexusPeriod).catch(() => [] as string[]),
  ]);
  let hits = mergeHits(mergeHits(added, updated), trending);
  const missing = ids.filter((id) => !hits.some((h) => h.sourceId === id)).slice(0, 60);
  if (missing.length) {
    const extra = await poolMap(missing, 6, (id) => nexusMod(key, id));
    hits = mergeHits(hits, extra);
  }
  if (query.trim() && !parsed.sourceId) {
    const q = query.trim().toLowerCase();
    hits = hits.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.author.toLowerCase().includes(q) ||
        h.description.toLowerCase().includes(q) ||
        (h.category || "").toLowerCase().includes(q),
    );
  }
  const counts = new Map<string, number>();
  for (const h of hits) {
    const c = normalizeCategory(h.category);
    h.category = c;
    counts.set(c, (counts.get(c) || 0) + 1);
  }
  const categories =
    meta.categories.length > 0
      ? meta.categories.map((c) => ({ ...c, count: counts.get(c.name) || 0 }))
      : [...counts.entries()].map(([name, count]) => ({ name, count }));
  return {
    hits,
    categories,
    total: meta.mods || hits.length,
    note: `Nexus live catalog · ${hits.length} cached pages${meta.mods ? ` of ${meta.mods}` : ""}.`,
  };
}

export async function steamWorkshopDetails(ids: string[]): Promise<SearchHit[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 30);
  if (!unique.length) return [];
  const body = new URLSearchParams();
  body.set("itemcount", String(unique.length));
  unique.forEach((id, i) => body.set(`publishedfileids[${i}]`, id));
  const res = await storeFetch("https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Palnest" },
    body,
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    response?: {
      publishedfiledetails?: Array<{
        publishedfileid: string;
        title?: string;
        file_description?: string;
        filename?: string;
        file_size?: number;
        time_created?: number;
        time_updated?: number;
        views?: number;
        subscriptions?: number;
        favorited?: number;
        preview_url?: string;
        creator?: string;
        tags?: Array<{ tag: string }>;
        result?: number;
      }>;
    };
  };
  return (json.response?.publishedfiledetails ?? [])
    .filter((d) => d.result === 1 || d.title)
    .map((d) => {
      const kind = fileKindFromName(d.filename || d.title || "");
      const tag = d.tags?.[0]?.tag;
      return {
        id: `st-live-${d.publishedfileid}`,
        name: d.title || `Workshop ${d.publishedfileid}`,
        author: d.creator ? `Steam ${d.creator}` : "Steam Workshop",
        version: "workshop",
        source: "steam" as const,
        sourceId: String(d.publishedfileid),
        url: storeUrl("steam", d.publishedfileid),
        downloads: d.subscriptions ?? d.views ?? 0,
        uniqueDownloads: d.subscriptions,
        endorsements: d.favorited,
        description: stripHtml(d.file_description || "Steam Workshop item.").slice(0, 600),
        body: (d.file_description || "").slice(0, 20000),
        kind: kind === "ini" || kind === "framework" ? "pak" : kind,
        updatedAt: d.time_updated ? isoFromUnix(d.time_updated) : new Date().toISOString(),
        publishedAt: d.time_created ? isoFromUnix(d.time_created) : undefined,
        serverCompatible: true,
        gameVersions: [],
        requires: [],
        image: d.preview_url,
        category: normalizeCategory(tag),
        sizeKb: Math.max(0, Math.round((d.file_size || 0) / 1024)),
        tags: (d.tags ?? []).map((t) => t.tag),
        files: [
          {
            id: d.publishedfileid,
            name: d.filename || `${(d.title || "workshop").replace(/[^\w.-]+/g, "_")}.zip`,
            sizeKb: Math.max(1, Math.round((d.file_size || 0) / 1024) || 512),
            kind: kind === "ini" || kind === "framework" ? "pak" : kind,
            note: "Steam Workshop archive. Palnest routes PAK vs Lua after SteamCMD pulls it.",
            category: "MAIN",
            primary: true,
          },
        ],
      } satisfies SearchHit;
    });
}

const STEAM_SORT: Record<DiscoverSort, string> = {
  published: "1",
  endorsements: "11",
  downloads: "9",
  unique: "9",
  updated: "17",
  name: "12",
  size: "9",
  comment: "17",
  surprise: "3",
};

export async function steamQueryFiles(opts: {
  key?: string;
  query: string;
  sort: DiscoverSort;
  period: DiscoverPeriod;
}): Promise<SearchHit[]> {
  const collected: SearchHit[] = [];
  let cursor = "*";
  const pages = opts.key ? 2 : 1;
  for (let page = 0; page < pages; page += 1) {
    const url = new URL("https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/");
    if (opts.key) url.searchParams.set("key", opts.key);
    url.searchParams.set("appid", STEAM_APP_ID);
    url.searchParams.set("return_details", "true");
    url.searchParams.set("return_previews", "true");
    url.searchParams.set("return_tags", "true");
    url.searchParams.set("return_vote_data", "true");
    url.searchParams.set("return_short_description", "true");
    url.searchParams.set("return_metadata", "true");
    url.searchParams.set("numperpage", opts.key ? "50" : "30");
    url.searchParams.set("cursor", cursor);
    const q = opts.query.trim();
    if (q) {
      url.searchParams.set("search_text", q);
      url.searchParams.set("query_type", "12");
    } else {
      url.searchParams.set("query_type", STEAM_SORT[opts.sort] || "1");
    }
    const days = opts.period === "1d" ? 1 : opts.period === "7d" ? 7 : opts.period === "14d" ? 14 : opts.period === "28d" ? 28 : 0;
    if (days) url.searchParams.set("days", String(days));
    const res = await storeFetch(url, { headers: { "User-Agent": "Palnest" } });
    if (!res.ok) break;
    const json = (await res.json()) as {
      response?: {
        next_cursor?: string;
        publishedfiledetails?: Array<{
          publishedfileid: string;
          title?: string;
          file_description?: string;
          short_description?: string;
          time_created?: number;
          time_updated?: number;
          preview_url?: string;
          subscriptions?: number;
          favorited?: number;
          file_size?: number;
          tags?: Array<{ tag: string }>;
          vote_data?: { votes_up?: number };
        }>;
      };
    };
    const details = json.response?.publishedfiledetails ?? [];
    if (!details.length) break;
    const ids = details.map((d) => d.publishedfileid);
    const rich = await steamWorkshopDetails(ids);
    const thin: SearchHit[] = details.map((d) => ({
      id: `st-live-${d.publishedfileid}`,
      name: d.title || `Workshop ${d.publishedfileid}`,
      author: "Steam Workshop",
      version: "workshop",
      source: "steam",
      sourceId: d.publishedfileid,
      url: storeUrl("steam", d.publishedfileid),
      downloads: d.subscriptions ?? 0,
      uniqueDownloads: d.subscriptions,
      endorsements: d.vote_data?.votes_up ?? d.favorited,
      description: stripHtml(d.short_description || d.file_description || "Steam Workshop item.").slice(0, 400),
      kind: "pak",
      updatedAt: d.time_updated ? isoFromUnix(d.time_updated) : new Date().toISOString(),
      publishedAt: d.time_created ? isoFromUnix(d.time_created) : undefined,
      serverCompatible: true,
      gameVersions: [],
      requires: [],
      image: d.preview_url,
      category: normalizeCategory(d.tags?.[0]?.tag),
      sizeKb: Math.max(0, Math.round((d.file_size || 0) / 1024)),
      tags: (d.tags ?? []).map((t) => t.tag),
    }));
    collected.push(...mergeHits(rich, thin));
    const next = json.response?.next_cursor;
    if (!next || next === cursor || next === "*") break;
    cursor = next;
  }
  return mergeHits([], collected);
}

async function curseforgeGameId(key: string): Promise<number> {
  try {
    const res = await storeFetch("https://api.curseforge.com/v1/games", {
      headers: { Accept: "application/json", "x-api-key": key, "User-Agent": "Palnest" },
    });
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ id: number; name?: string; slug?: string }> };
      const pal = (json.data ?? []).find((g) => /palworld/i.test(`${g.slug} ${g.name}`));
      if (pal?.id) return pal.id;
    }
  } catch {
    /* fallback */
  }
  return CURSE_GAME_ID;
}

const CF_SORT: Record<DiscoverSort, string> = {
  published: "11",
  endorsements: "2",
  downloads: "6",
  unique: "6",
  updated: "3",
  name: "4",
  size: "6",
  comment: "3",
  surprise: "2",
};

type CfMod = {
  id: number;
  name: string;
  summary?: string;
  downloadCount?: number;
  thumbsUpCount?: number;
  dateCreated?: string;
  dateModified?: string;
  dateReleased?: string;
  authors?: Array<{ name: string }>;
  links?: { websiteUrl?: string };
  logo?: { url?: string; thumbnailUrl?: string };
  categories?: Array<{ name: string; id: number }>;
  latestFiles?: Array<{ id: number; fileName: string; fileLength?: number; displayName?: string; fileDate?: string }>;
  latestFilesIndexes?: Array<{ fileName?: string }>;
};

function hitFromCurse(m: CfMod): SearchHit {
  const cat = normalizeCategory(m.categories?.[0]?.name);
  const latest = m.latestFiles?.[0];
  const kind = fileKindFromName(latest?.fileName || m.name);
  return {
    id: `cf-live-${m.id}`,
    name: m.name,
    author: m.authors?.[0]?.name || "CurseForge",
    version: latest?.displayName || "—",
    source: "curseforge",
    sourceId: String(m.id),
    url: m.links?.websiteUrl || storeUrl("curseforge", String(m.id)),
    downloads: m.downloadCount ?? 0,
    uniqueDownloads: m.downloadCount,
    endorsements: m.thumbsUpCount,
    description: m.summary || "CurseForge Palworld pack.",
    body: m.summary,
    kind: kind === "ini" || kind === "framework" ? "palschema" : kind,
    updatedAt: m.dateModified || m.dateReleased || new Date().toISOString(),
    publishedAt: m.dateCreated || m.dateReleased,
    serverCompatible: true,
    gameVersions: [],
    requires: [],
    image: m.logo?.url || m.logo?.thumbnailUrl,
    category: cat,
    sizeKb: latest ? Math.max(0, Math.round((latest.fileLength || 0) / 1024)) : 0,
    files: (m.latestFiles ?? []).map((f) => ({
      id: String(f.id),
      name: f.fileName,
      sizeKb: Math.max(1, Math.round((f.fileLength || 0) / 1024)),
      kind: fileKindFromName(f.fileName),
      note: f.displayName || "CurseForge file",
      category: "MAIN",
      uploadedAt: f.fileDate,
      primary: f.id === latest?.id,
    })),
  };
}

export async function curseforgeSearch(opts: {
  key: string;
  query: string;
  sort: DiscoverSort;
}): Promise<SearchHit[]> {
  const gameId = await curseforgeGameId(opts.key);
  const url = new URL("https://api.curseforge.com/v1/mods/search");
  url.searchParams.set("gameId", String(gameId));
  url.searchParams.set("pageSize", "50");
  url.searchParams.set("sortField", CF_SORT[opts.sort] || "3");
  url.searchParams.set("sortOrder", "desc");
  if (opts.query.trim()) url.searchParams.set("searchFilter", opts.query.trim());
  const res = await storeFetch(url, {
    headers: { Accept: "application/json", "x-api-key": opts.key, "User-Agent": "Palnest" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: CfMod[] };
  return (json.data ?? []).map(hitFromCurse);
}

export async function curseforgeMod(key: string, id: string): Promise<SearchHit | null> {
  const res = await storeFetch(`https://api.curseforge.com/v1/mods/${id}`, {
    headers: { Accept: "application/json", "x-api-key": key, "User-Agent": "Palnest" },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: CfMod };
  return json.data ? hitFromCurse(json.data) : null;
}

export async function curseforgeFiles(key: string, id: string): Promise<ModFileChoice[]> {
  const res = await storeFetch(`https://api.curseforge.com/v1/mods/${id}/files`, {
    headers: { Accept: "application/json", "x-api-key": key, "User-Agent": "Palnest" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: Array<{
      id: number;
      fileName: string;
      fileLength?: number;
      displayName?: string;
      fileDate?: string;
      releaseType?: number;
    }>;
  };
  return (json.data ?? []).map((f) => ({
    id: String(f.id),
    name: f.fileName,
    sizeKb: Math.max(1, Math.round((f.fileLength || 0) / 1024)),
    kind: fileKindFromName(f.fileName),
    note: f.displayName || "CurseForge file",
    category: f.releaseType === 1 ? "MAIN" : f.releaseType === 2 ? "OPTIONAL" : "MAIN",
    uploadedAt: f.fileDate,
    primary: f.releaseType === 1,
  }));
}

export async function curseforgeDescription(key: string, id: string): Promise<string> {
  const res = await storeFetch(`https://api.curseforge.com/v1/mods/${id}/description`, {
    headers: { Accept: "application/json", "x-api-key": key, "User-Agent": "Palnest" },
  });
  if (!res.ok) return "";
  const json = (await res.json()) as { data?: string };
  return stripHtml(json.data || "").slice(0, 8000);
}

export async function curseforgeCategories(key: string): Promise<DiscoverCategory[]> {
  const gameId = await curseforgeGameId(key);
  const res = await storeFetch(`https://api.curseforge.com/v1/categories?gameId=${gameId}`, {
    headers: { Accept: "application/json", "x-api-key": key, "User-Agent": "Palnest" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: Array<{ id: number; name?: string }> };
  const seen = new Set<string>();
  const rows: DiscoverCategory[] = [];
  for (const c of json.data ?? []) {
    const name = normalizeCategory(c.name);
    if (seen.has(name)) continue;
    seen.add(name);
    rows.push({ name, count: 0, id: String(c.id) });
  }
  return rows;
}

export async function loadFiles(opts: {
  source: ModSource;
  sourceId: string;
  name: string;
  kind: SearchHit["kind"];
  nexusKey?: string;
  curseforgeKey?: string;
  steamKey?: string;
}): Promise<{ files: ModFileChoice[]; live: boolean; note: string }> {
  if (opts.source === "nexus" && opts.nexusKey && opts.sourceId) {
    const files = await nexusFiles(opts.nexusKey, opts.sourceId);
    if (files.length) return { files, live: true, note: `${files.length} files from Nexus.` };
  }
  if (opts.source === "curseforge" && opts.curseforgeKey && opts.sourceId) {
    const files = await curseforgeFiles(opts.curseforgeKey, opts.sourceId);
    if (files.length) return { files, live: true, note: `${files.length} files from CurseForge.` };
  }
  if (opts.source === "steam" && opts.sourceId) {
    const steamHits = await steamWorkshopDetails([opts.sourceId]);
    const files = steamHits[0]?.files;
    if (files?.length) return { files, live: true, note: "Steam Workshop archive." };
    return {
      files: [
        {
          id: opts.sourceId,
          name: `${opts.name.replace(/[^\w.-]+/g, "_") || "workshop"}.zip`,
          sizeKb: 512,
          kind: opts.kind === "pak" ? "pak" : "ue4ss",
          note: "Steam Workshop item — Palnest inspects PAK vs Lua after SteamCMD pulls it.",
          category: "MAIN",
          primary: true,
        },
      ],
      live: false,
      note: "Workshop items are a single archive.",
    };
  }
  return {
    files: filesForHit({ name: opts.name, kind: opts.kind, files: undefined, source: opts.source }),
    live: false,
    note: "Index files. Palnest routes PAK vs UE4SS from the file name.",
  };
}

export async function loadDetail(opts: {
  id?: string;
  source: ModSource;
  sourceId: string;
  name?: string;
  kind?: SearchHit["kind"];
  nexusKey?: string;
  curseforgeKey?: string;
  steamKey?: string;
}): Promise<{ hit: SearchHit; files: ModFileChoice[]; live: boolean; note: string }> {
  const catalog =
    CATALOG.find((m) => m.id === opts.id) ||
    CATALOG.find((m) => m.source === opts.source && m.sourceId === opts.sourceId);
  let hit: SearchHit | null = catalog ? catalogToHit(catalog) : null;
  let live = false;
  const notes: string[] = [];

  if (opts.source === "nexus" && opts.nexusKey && opts.sourceId) {
    try {
      const nx = await nexusMod(opts.nexusKey, opts.sourceId);
      if (nx) {
        hit = hit ? { ...hit, ...nx, id: hit.id } : nx;
        live = true;
        notes.push("Nexus mod page.");
      }
    } catch {
      notes.push("Nexus page unreachable.");
    }
  }
  if (opts.source === "steam" && opts.sourceId) {
    try {
      const steamHits = await steamWorkshopDetails([opts.sourceId]);
      if (steamHits[0]) {
        const st = steamHits[0];
        hit = hit ? { ...hit, ...st, id: hit.id, kind: hit.kind || st.kind } : st;
        live = true;
        notes.push("Steam Workshop page.");
      }
    } catch {
      notes.push("Steam Workshop page missed.");
    }
  }
  if (opts.source === "curseforge" && opts.curseforgeKey && opts.sourceId) {
    try {
      const [cf, desc] = await Promise.all([
        curseforgeMod(opts.curseforgeKey, opts.sourceId),
        curseforgeDescription(opts.curseforgeKey, opts.sourceId),
      ]);
      if (cf) {
        hit = hit ? { ...hit, ...cf, id: hit.id } : cf;
        live = true;
        notes.push("CurseForge project page.");
      }
      if (desc) {
        hit = hit ? { ...hit, body: desc, description: hit.description || desc.slice(0, 400) } : hit;
        notes.push("CurseForge description.");
      }
    } catch {
      notes.push("CurseForge page unreachable.");
    }
  }

  if (!hit) {
    hit = {
      id: opts.id || `${opts.source}--${opts.sourceId}`,
      name: opts.name || `${opts.source} ${opts.sourceId}`,
      author: opts.source,
      version: "—",
      source: opts.source,
      sourceId: opts.sourceId,
      url: storeUrl(opts.source, opts.sourceId),
      downloads: 0,
      description: "Open this pack from Discover, or add the matching store API key in Settings.",
      kind: opts.kind || "pak",
      updatedAt: new Date().toISOString(),
      serverCompatible: true,
      gameVersions: [],
      requires: [],
    };
  }

  const loaded = await loadFiles({
    source: hit.source,
    sourceId: hit.sourceId,
    name: hit.name,
    kind: hit.kind,
    nexusKey: opts.nexusKey,
    curseforgeKey: opts.curseforgeKey,
    steamKey: opts.steamKey,
  });
  const files = loaded.files.length ? loaded.files : hit.files?.length ? hit.files : filesForHit(hit);
  if (loaded.live) {
    live = true;
    notes.push(loaded.note);
  }
  const sizeKb = files.reduce((n, f) => n + (f.sizeKb || 0), hit.sizeKb || 0);
  hit = { ...hit, files, sizeKb, cachedAt: new Date().toISOString() };
  return { hit, files, live, note: notes.filter(Boolean).join(" ") || "Palnest index page." };
}

export async function browseStores(data: {
  query: string;
  source: DiscoverSource;
  nexusKey?: string;
  curseforgeKey?: string;
  steamKey?: string;
  period?: DiscoverPeriod;
  sort?: DiscoverSort;
}): Promise<{ hits: SearchHit[]; live: boolean; note: string; categories: DiscoverCategory[]; total: number }> {
  const period = data.period || "all";
  const sort = data.sort || "published";
  const catalogSource = data.source === "all" ? undefined : data.source;
  let hits = searchCatalog(data.query, catalogSource).map(catalogToHit);
  let live = false;
  const notes: string[] = [];
  let categories: DiscoverCategory[] = [];
  let total = hits.length;

  const wantsNexus = data.source === "all" || data.source === "nexus";
  const wantsSteam = data.source === "all" || data.source === "steam";
  const wantsCurse = data.source === "all" || data.source === "curseforge";

  if (wantsNexus && data.nexusKey) {
    try {
      const nx = await nexusBrowse(data.nexusKey, data.query, period);
      if (nx.hits.length) {
        hits = data.source === "nexus" ? mergeHits(nx.hits, hits) : mergeHits(hits, nx.hits);
        live = true;
        notes.push(nx.note);
        if (nx.categories.length) categories = nx.categories;
        total = Math.max(total, nx.total);
      }
    } catch {
      notes.push("Nexus API unreachable — showing the Palnest index.");
    }
  } else if (wantsNexus && !data.nexusKey) {
    notes.push("Add a Nexus API key in Settings to pull the live Palworld catalog.");
  }

  if (wantsSteam) {
    try {
      const catalogIds = CATALOG.filter((m) => m.source === "steam").map((m) => m.sourceId);
      const parsed = parseModQuery(data.query);
      const extraIds = parsed.sourceId && (!parsed.source || parsed.source === "steam") ? [parsed.sourceId] : [];
      const details = await steamWorkshopDetails([...catalogIds, ...extraIds]);
      if (details.length) {
        hits = mergeHits(hits, details);
        live = true;
        notes.push("Steam Workshop pages (no key required).");
      }
    } catch {
      notes.push("Steam Workshop details missed.");
    }
    try {
      const queried = await steamQueryFiles({
        key: data.steamKey,
        query: data.query,
        sort,
        period,
      });
      if (queried.length) {
        hits = mergeHits(queried, hits);
        live = true;
        notes.push(data.steamKey ? "Steam Web API QueryFiles." : "Steam workshop search.");
      } else if (data.steamKey) {
        notes.push("Steam QueryFiles returned no rows for this filter.");
      } else if (wantsSteam) {
        notes.push("Add a Steam Web API key for full workshop search, sort, and time filters.");
      }
    } catch {
      notes.push("Steam QueryFiles unreachable.");
    }
  }

  if (wantsCurse && data.curseforgeKey) {
    try {
      const parsed = parseModQuery(data.query);
      if (parsed.sourceId && (!parsed.source || parsed.source === "curseforge") && /^\d+$/.test(parsed.sourceId)) {
        const one = await curseforgeMod(data.curseforgeKey, parsed.sourceId);
        if (one) {
          hits = mergeHits([one], hits);
          live = true;
          notes.push(`CurseForge project ${parsed.sourceId}.`);
        }
      }
      const [cf, cfCats] = await Promise.all([
        curseforgeSearch({ key: data.curseforgeKey, query: data.query, sort }),
        curseforgeCategories(data.curseforgeKey).catch(() => [] as DiscoverCategory[]),
      ]);
      if (cf.length) {
        hits = mergeHits(cf, hits);
        live = true;
        notes.push("CurseForge Palworld search.");
      }
      if (cfCats.length && (data.source === "curseforge" || !categories.length)) {
        const counts = new Map<string, number>();
        for (const h of hits.filter((x) => x.source === "curseforge")) {
          const c = normalizeCategory(h.category);
          counts.set(c, (counts.get(c) || 0) + 1);
        }
        categories = cfCats.map((c) => ({ ...c, count: counts.get(c.name) || 0 }));
      }
    } catch {
      notes.push("CurseForge API unreachable.");
    }
  } else if (wantsCurse && !data.curseforgeKey) {
    notes.push("Add a CurseForge API key to search Palworld projects live.");
  }

  if (data.source !== "all") hits = hits.filter((h) => h.source === data.source);
  if (!hits.length) {
    hits = (catalogSource ? CATALOG.filter((m) => m.source === catalogSource) : CATALOG).map(catalogToHit);
  }

  if (!categories.length) {
    const counts = new Map<string, number>();
    for (const h of hits) {
      const c = normalizeCategory(h.category);
      h.category = c;
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    categories = NEXUS_CATEGORIES.map((name) => ({ name, count: counts.get(name) || 0 })).filter(
      (c) => data.source !== "nexus" || c.count > 0 || true,
    );
    for (const [name, count] of counts) {
      if (!categories.some((c) => c.name === name)) categories.push({ name, count });
    }
  }

  const note =
    notes.filter(Boolean).join(" ") ||
    (data.source === "all"
      ? "Palnest index across Nexus, Steam Workshop, and CurseForge. Add API keys in Settings for live catalogs."
      : data.source === "nexus"
        ? "Add a Nexus API key in Settings to pull latest-added, trending, and file lists."
        : data.source === "steam"
          ? "Workshop pages load without a key. A Steam Web API key unlocks QueryFiles search."
          : "Add a CurseForge API key to browse Palworld projects.");

  return { hits, live, note, categories, total: Math.max(total, hits.length) };
}
