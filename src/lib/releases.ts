import { createServerFn } from "@tanstack/react-start";
import { CATALOG, searchCatalog, catalogToHit } from "./catalog.ts";
import { parseModQuery } from "./mod-query.ts";
import { fileKindFromName, filesForHit } from "./mod-kind.ts";
import type { ModFileChoice, ModSource, RemoteRelease, SearchHit } from "./types";

type GhRelease = {
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  published_at: string;
  prerelease: boolean;
  assets: { name: string; size: number; url: string; browser_download_url: string }[];
};

async function ghReleases(repo: string, n = 5): Promise<RemoteRelease[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=${n}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Palnest",
    },
  });
  if (!res.ok) throw new Error(`GitHub ${repo} ${res.status}`);
  const data = (await res.json()) as GhRelease[];
  return data.map((r) => ({
    repo,
    tag: r.tag_name,
    name: r.name || r.tag_name,
    publishedAt: r.published_at,
    body: (r.body || "").slice(0, 1800),
    htmlUrl: r.html_url,
    prerelease: r.prerelease,
    assets: (r.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.url,
      downloadUrl: a.browser_download_url,
    })),
  }));
}

export const fetchUe4ssReleases = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, releases: await ghReleases("Okaetsu/RE-UE4SS", 20) };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "UE4SS lookup failed",
      releases: [
        {
          repo: "Okaetsu/RE-UE4SS",
          tag: "experimental-palworld",
          name: "Palworld (2281fa31)",
          publishedAt: "2026-09-03T21:06:00.000Z",
          body: "Palworld-specific UE4SS. Download UE4SS-Palworld.zip for playing, _zDev for authors.",
          htmlUrl: "https://github.com/Okaetsu/RE-UE4SS/releases/latest",
          prerelease: false,
          assets: [
            {
              name: "UE4SS-Palworld.zip",
              size: 42000000,
              url: "https://github.com/Okaetsu/RE-UE4SS/releases/latest",
              downloadUrl: "https://github.com/Okaetsu/RE-UE4SS/releases/latest",
            },
          ],
        },
      ] satisfies RemoteRelease[],
    };
  }
});

export const fetchPalSchemaReleases = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return { ok: true as const, releases: await ghReleases("Okaetsu/PalSchema", 5) };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "PalSchema lookup failed",
      releases: [
        {
          repo: "Okaetsu/PalSchema",
          tag: "0.6.71",
          name: "0.6.71",
          publishedAt: "2026-09-09T14:45:00.000Z",
          body: "Requires UE4SS 2281fa31. Signature update.",
          htmlUrl: "https://github.com/Okaetsu/PalSchema/releases/latest",
          prerelease: false,
          assets: [
            {
              name: "PalSchema.zip",
              size: 1800000,
              url: "https://github.com/Okaetsu/PalSchema/releases/latest",
              downloadUrl: "https://github.com/Okaetsu/PalSchema/releases/latest",
            },
          ],
        },
      ] satisfies RemoteRelease[],
    };
  }
});

export const searchMods = createServerFn({ method: "POST" })
  .validator((data: { query: string; source: ModSource; nexusKey?: string; curseforgeKey?: string; steamKey?: string }) => data)
  .handler(async ({ data }): Promise<{ hits: SearchHit[]; live: boolean; note?: string }> => {
    const parsed = parseModQuery(data.query);
    let local = searchCatalog(data.query, data.source).map(catalogToHit);
    if (data.source === "nexus" && data.nexusKey && parsed.sourceId && (!parsed.source || parsed.source === "nexus")) {
      try {
        const res = await fetch(`https://api.nexusmods.com/v1/games/palworld/mods/${parsed.sourceId}.json`, {
          headers: { apikey: data.nexusKey, Accept: "application/json" },
        });
        if (res.ok) {
          const m = (await res.json()) as { mod_id?: number; name?: string; summary?: string; author?: string; version?: string };
          const hit: SearchHit = {
            id: `nx-id-${parsed.sourceId}`,
            name: m.name || `Nexus ${parsed.sourceId}`,
            author: m.author || "Nexus",
            version: m.version || "—",
            source: "nexus",
            sourceId: String(m.mod_id ?? parsed.sourceId),
            url: `https://www.nexusmods.com/palworld/mods/${parsed.sourceId}`,
            downloads: 0,
            description: m.summary || "Opened from a Nexus mod id / URL.",
            kind: "pak",
            updatedAt: new Date().toISOString(),
            serverCompatible: true,
            gameVersions: [],
            requires: [],
          };
          return { hits: [hit, ...local.filter((h) => h.sourceId !== hit.sourceId)], live: true, note: `Nexus mod ${parsed.sourceId}.` };
        }
      } catch {
        /* fall through to latest_added */
      }
    }
    if (data.source === "steam" && parsed.sourceId && (!parsed.source || parsed.source === "steam")) {
      const idHit = local.find((h) => h.sourceId === parsed.sourceId);
      if (!idHit) {
        local = [
          {
            id: `st-id-${parsed.sourceId}`,
            name: `Workshop ${parsed.sourceId}`,
            author: "Steam Workshop",
            version: "workshop",
            source: "steam",
            sourceId: parsed.sourceId,
            url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${parsed.sourceId}`,
            downloads: 0,
            description: "Opened from a Steam Workshop id / URL.",
            kind: "ue4ss",
            updatedAt: new Date().toISOString(),
            serverCompatible: true,
            gameVersions: [],
            requires: [],
          },
          ...local,
        ];
      }
    }
    if (data.source === "nexus" && data.nexusKey) {
      try {
        const res = await fetch("https://api.nexusmods.com/v1/games/palworld/mods/latest_added.json", {
          headers: { apikey: data.nexusKey, Accept: "application/json" },
        });
        if (res.ok) {
          const json = (await res.json()) as Array<{
            mod_id: number;
            name: string;
            summary?: string;
            author?: string;
            version?: string;
            uid?: number;
          }>;
          const liveHits: SearchHit[] = json.slice(0, 16).map((m) => ({
            id: `nx-live-${m.mod_id}`,
            name: m.name,
            author: m.author || "Nexus",
            version: m.version || "—",
            source: "nexus",
            sourceId: String(m.mod_id),
            url: `https://www.nexusmods.com/palworld/mods/${m.mod_id}`,
            downloads: 0,
            description: m.summary || "Latest added on Nexus Mods for Palworld.",
            kind: "pak",
            updatedAt: new Date().toISOString(),
            serverCompatible: true,
            gameVersions: [],
            requires: [],
          }));
          const merged = [...liveHits];
          for (const hit of local) {
            if (!merged.some((h) => h.name === hit.name)) merged.push(hit);
          }
          return { hits: merged, live: true };
        }
        return { hits: local, live: false, note: `Nexus ${res.status}. Showing the Palnest index.` };
      } catch {
        return { hits: local, live: false, note: "Nexus unreachable. Showing the Palnest index." };
      }
    }

    if (data.source === "steam" && data.steamKey) {
      try {
        const url = new URL("https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/");
        url.searchParams.set("key", data.steamKey);
        url.searchParams.set("appid", "1623730");
        url.searchParams.set("search_text", data.query || "palworld");
        url.searchParams.set("return_details", "true");
        url.searchParams.set("numperpage", "16");
        const res = await fetch(url);
        if (res.ok) {
          const json = (await res.json()) as {
            response?: {
              publishedfiledetails?: Array<{
                publishedfileid: string;
                title: string;
                file_description?: string;
                time_updated?: number;
              }>;
            };
          };
          const details = json.response?.publishedfiledetails ?? [];
          if (details.length) {
            return {
              hits: details.map((d) => ({
                id: `st-live-${d.publishedfileid}`,
                name: d.title,
                author: "Steam Workshop",
                version: "workshop",
                source: "steam",
                sourceId: d.publishedfileid,
                url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${d.publishedfileid}`,
                downloads: 0,
                description: (d.file_description || "Steam Workshop item.").slice(0, 240),
                kind: "pak",
                updatedAt: d.time_updated
                  ? new Date(d.time_updated * 1000).toISOString()
                  : new Date().toISOString(),
                serverCompatible: true,
                gameVersions: [],
                requires: [],
              })),
              live: true,
            };
          }
        }
        return { hits: local, live: false, note: "Steam returned no files. Showing the Palnest index." };
      } catch {
        return { hits: local, live: false, note: "Steam API unreachable. Showing the Palnest index." };
      }
    }

    if (data.source === "curseforge" && data.curseforgeKey) {
      try {
        const res = await fetch(
          "https://api.curseforge.com/v1/mods/search?gameId=432&pageSize=8&searchFilter=" +
            encodeURIComponent(data.query || "palworld"),
          { headers: { Accept: "application/json", "x-api-key": data.curseforgeKey } },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            data?: Array<{
              id: number;
              name: string;
              summary?: string;
              downloadCount?: number;
              authors?: Array<{ name: string }>;
              links?: { websiteUrl?: string };
            }>;
          };
          const rows = json.data ?? [];
          if (rows.length) {
            const liveHits: SearchHit[] = rows.map((m) => ({
              id: `cf-live-${m.id}`,
              name: m.name,
              author: m.authors?.[0]?.name || "CurseForge",
              version: "—",
              source: "curseforge",
              sourceId: String(m.id),
              url: m.links?.websiteUrl || "https://www.curseforge.com/",
              downloads: m.downloadCount ?? 0,
              description: m.summary || "CurseForge result.",
              kind: "palschema",
              updatedAt: new Date().toISOString(),
              serverCompatible: true,
              gameVersions: [],
              requires: [],
            }));
            return { hits: [...liveHits, ...local], live: true, note: "CurseForge has no first-party Palworld game id; mixed with the Palnest index." };
          }
        }
        return { hits: local, live: false, note: "CurseForge key did not return Palworld files. Showing the Palnest index." };
      } catch {
        return { hits: local, live: false, note: "CurseForge unreachable. Showing the Palnest index." };
      }
    }

    return {
      hits: local.length ? local : CATALOG.filter((m) => m.source === data.source).map(catalogToHit),
      live: false,
      note: data.source === "nexus"
        ? "Add a Nexus API key in Settings to pull latest-added live."
        : data.source === "steam"
          ? "Add a Steam Web API key to query Workshop live."
          : "Add a CurseForge API key, or browse the Palnest index.",
    };
  });

export const fetchModFiles = createServerFn({ method: "POST" })
  .validator(
    (data: {
      source: ModSource;
      sourceId: string;
      name: string;
      kind: SearchHit["kind"];
      nexusKey?: string;
      curseforgeKey?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ files: ModFileChoice[]; live: boolean; note?: string }> => {
    const fallback = filesForHit({
      name: data.name,
      kind: data.kind,
      files: undefined,
      sizeKb: 256,
      source: data.source,
    });
    if (data.source === "nexus" && data.nexusKey && data.sourceId) {
      try {
        const res = await fetch(`https://api.nexusmods.com/v1/games/palworld/mods/${data.sourceId}/files.json`, {
          headers: { apikey: data.nexusKey, Accept: "application/json" },
        });
        if (res.ok) {
          const json = (await res.json()) as {
            files?: Array<{ file_id: number; file_name: string; size?: number; file_size?: number; description?: string }>;
          };
          const files = (json.files ?? []).map((f) => {
            const kind = fileKindFromName(f.file_name);
            return {
              id: String(f.file_id),
              name: f.file_name,
              sizeKb: Math.max(1, Math.round((f.size || f.file_size || 0) / 1024)),
              kind,
              note: f.description?.slice(0, 120) || `${kind} from Nexus`,
            } satisfies ModFileChoice;
          });
          if (files.length) return { files, live: true, note: "Nexus file list." };
        }
      } catch {
        /* fallback */
      }
    }
    if (data.source === "curseforge" && data.curseforgeKey && data.sourceId) {
      try {
        const res = await fetch(`https://api.curseforge.com/v1/mods/${data.sourceId}/files`, {
          headers: { Accept: "application/json", "x-api-key": data.curseforgeKey },
        });
        if (res.ok) {
          const json = (await res.json()) as {
            data?: Array<{ id: number; fileName: string; fileLength?: number; displayName?: string }>;
          };
          const files = (json.data ?? []).map((f) => {
            const kind = fileKindFromName(f.fileName);
            return {
              id: String(f.id),
              name: f.fileName,
              sizeKb: Math.max(1, Math.round((f.fileLength || 0) / 1024)),
              kind,
              note: f.displayName || `${kind} from CurseForge`,
            } satisfies ModFileChoice;
          });
          if (files.length) return { files, live: true, note: "CurseForge file list." };
        }
      } catch {
        /* fallback */
      }
    }
    if (data.source === "steam") {
      return {
        files: [
          {
            id: data.sourceId || "workshop",
            name: `${data.name.replace(/[^\w.-]+/g, "_") || "workshop"}.zip`,
            sizeKb: 512,
            kind: fileKindFromName(data.name) === "pak" ? "pak" : data.kind === "pak" ? "pak" : "ue4ss",
            note: "Steam Workshop item — Palnest inspects PAK vs Lua after SteamCMD pulls it.",
          },
        ],
        live: false,
        note: "Workshop items are a single archive. Kind is confirmed on extract.",
      };
    }
    return { files: fallback, live: false, note: "Index files. Palnest routes PAK vs UE4SS from the file name." };
  });
