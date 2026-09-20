import { createServerFn } from "@tanstack/react-start";
import { browseStores, loadDetail, loadFiles } from "./mod-stores.ts";
import type { DiscoverCategory, DiscoverPeriod, DiscoverSort, DiscoverSource, ModFileChoice, ModSource, RemoteRelease, SearchHit } from "./types";

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
  .validator(
    (data: {
      query: string;
      source: DiscoverSource;
      nexusKey?: string;
      curseforgeKey?: string;
      steamKey?: string;
      period?: DiscoverPeriod;
      sort?: DiscoverSort;
    }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{ hits: SearchHit[]; live: boolean; note?: string; categories: DiscoverCategory[]; total: number }> => {
      return browseStores(data);
    },
  );

export const fetchModFiles = createServerFn({ method: "POST" })
  .validator(
    (data: {
      source: ModSource;
      sourceId: string;
      name: string;
      kind: SearchHit["kind"];
      nexusKey?: string;
      curseforgeKey?: string;
      steamKey?: string;
    }) => data,
  )
  .handler(async ({ data }): Promise<{ files: ModFileChoice[]; live: boolean; note?: string }> => {
    return loadFiles(data);
  });

export const fetchModDetail = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      source: ModSource;
      sourceId: string;
      name?: string;
      kind?: SearchHit["kind"];
      nexusKey?: string;
      curseforgeKey?: string;
      steamKey?: string;
    }) => data,
  )
  .handler(
    async ({
      data,
    }): Promise<{ hit: SearchHit | null; files: ModFileChoice[]; live: boolean; note?: string }> => {
      return loadDetail(data);
    },
  );
