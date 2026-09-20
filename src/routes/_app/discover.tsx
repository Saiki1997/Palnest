import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useChildMatches, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Clock, Download, HardDrive, LayoutGrid, Search, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { searchMods } from "@/lib/releases";
import { catalogToHit, searchCatalog } from "@/lib/catalog";
import { NEXUS_CATEGORIES, normalizeCategory } from "@/lib/mod-meta";
import { discoverPathId } from "@/lib/mod-query";
import { steamcmdWorkshop } from "@/lib/runtime";
import { useAppStore } from "@/lib/store";
import { cn, formatCount, formatDayLong, formatSizePretty, periodCutoff } from "@/lib/utils";
import type { DiscoverCategory, DiscoverPeriod, DiscoverSort, DiscoverSource, SearchHit } from "@/lib/types";

export const Route = createFileRoute("/_app/discover")({ component: DiscoverGate });

function DiscoverGate() {
  const children = useChildMatches();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showMod = children.length > 0 || /^\/discover\/[^/]+/.test(pathname);
  if (showMod) return <Outlet />;
  return <DiscoverPage />;
}

const SOURCES: { id: DiscoverSource; label: string }[] = [
  { id: "nexus", label: "Nexus Mods" },
  { id: "steam", label: "Steam Workshop" },
  { id: "curseforge", label: "CurseForge" },
  { id: "all", label: "All sources" },
];

const PERIODS: { id: DiscoverPeriod; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "1d", label: "24 Hours" },
  { id: "7d", label: "7 Days" },
  { id: "14d", label: "14 Days" },
  { id: "28d", label: "28 Days" },
  { id: "1y", label: "1 Year" },
  { id: "custom", label: "Custom range" },
];

const SORTS: { id: DiscoverSort; label: string }[] = [
  { id: "published", label: "Date Published" },
  { id: "endorsements", label: "Endorsements" },
  { id: "downloads", label: "Downloads" },
  { id: "unique", label: "Unique Downloads" },
  { id: "updated", label: "Last Updated" },
  { id: "name", label: "Mod Name" },
  { id: "size", label: "File Size" },
  { id: "comment", label: "Last Comment" },
  { id: "surprise", label: "Surprise" },
];

function DiscoverPage() {
  const keys = useAppStore((s) => s.keys);
  const mode = useAppStore((s) => s.mode);
  const installHit = useAppStore((s) => s.installHit);
  const rememberHit = useAppStore((s) => s.rememberHit);
  const setPeekHit = useAppStore((s) => s.setPeekHit);
  const cacheMods = useAppStore((s) => s.cacheMods);
  const modCache = useAppStore((s) => s.modCache) ?? {};
  const paths = useAppStore((s) => s.paths);
  const log = useAppStore((s) => s.log);

  const [source, setSource] = useState<DiscoverSource>("nexus");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<DiscoverPeriod>("all");
  const [sort, setSort] = useState<DiscoverSort>("published");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [cats, setCats] = useState<string[]>([]);
  const [includeTag, setIncludeTag] = useState("");
  const [excludeTag, setExcludeTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [workshopId, setWorkshopId] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [categories, setCategories] = useState<DiscoverCategory[]>([]);
  const [live, setLive] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function runSearch(src = source, query = q, silent = false) {
    setBusy(true);
    try {
      const res = await searchMods({
        data: {
          query,
          source: src,
          nexusKey: keys.nexus || undefined,
          curseforgeKey: keys.curseforge || undefined,
          steamKey: keys.steam || undefined,
          period,
          sort,
        },
      });
      setHits(res.hits);
      setLive(res.live);
      setNote(res.note || "");
      setCategories(res.categories || []);
      cacheMods(src, { query, hits: res.hits, live: res.live, note: res.note || "" });
      if (!silent) toast.success(res.live ? `Loaded ${res.hits.length} from stores` : "Showing cached / catalog packs");
    } catch (err) {
      const fallback = searchCatalog(query, src === "all" ? undefined : src).map(catalogToHit);
      setHits(fallback);
      setLive(false);
      setNote(err instanceof Error ? err.message : "Store lookup failed");
      if (!silent) toast.error("Stores unreachable — showing Palnest index");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [source, q, period, sort, dir, pageSize, cats, includeTag, excludeTag]);

  useEffect(() => {
    const bucket = modCache[source];
    if (bucket?.hits?.length) {
      setHits(bucket.hits);
      setLive(bucket.live);
      setNote(bucket.note || "");
    }
    void runSearch(source, q, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, keys.nexus, keys.steam, keys.curseforge, period, sort]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of hits) for (const t of h.tags ?? []) if (t.trim()) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [hits]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const cut = periodCutoff(period, from, to);
    const start = cut.start;
    const end = cut.end;
    let rows = hits.filter((h) => {
      if (cats.length && !cats.includes(normalizeCategory(h.category))) return false;
      if (includeTag && !(h.tags ?? []).some((t) => t.toLowerCase() === includeTag.toLowerCase())) return false;
      if (excludeTag && (h.tags ?? []).some((t) => t.toLowerCase() === excludeTag.toLowerCase())) return false;
      if (needle) {
        const hay = `${h.name} ${h.author} ${h.description} ${h.category ?? ""}`.toLowerCase();
        if (!hay.includes(needle) && h.sourceId !== q.trim()) return false;
      }
      const t = new Date(h.publishedAt || h.updatedAt).getTime();
      if (start && t < start) return false;
      if (end && t > end) return false;
      return true;
    });
    const mul = dir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sort === "surprise") return Math.random() - 0.5;
      if (sort === "name") return mul * a.name.localeCompare(b.name);
      if (sort === "endorsements") return mul * ((a.endorsements || 0) - (b.endorsements || 0));
      if (sort === "downloads") return mul * ((a.downloads || 0) - (b.downloads || 0));
      if (sort === "unique") return mul * ((a.uniqueDownloads || a.downloads || 0) - (b.uniqueDownloads || b.downloads || 0));
      if (sort === "size") return mul * ((a.sizeKb || 0) - (b.sizeKb || 0));
      if (sort === "updated" || sort === "comment") {
        return mul * (new Date(a.lastComment || a.updatedAt).getTime() - new Date(b.lastComment || b.updatedAt).getTime());
      }
      return mul * (new Date(a.publishedAt || a.updatedAt).getTime() - new Date(b.publishedAt || b.updatedAt).getTime());
    });
    return rows;
  }, [hits, cats, includeTag, excludeTag, q, period, from, to, sort, dir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const catRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of hits) {
      const c = normalizeCategory(h.category);
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    const names = categories.length ? categories.map((c) => c.name) : [...NEXUS_CATEGORIES];
    for (const name of counts.keys()) if (!names.includes(name)) names.push(name);
    return names.map((name) => ({
      name,
      count: counts.get(name) || 0,
    }));
  }, [categories, hits]);

  function remember(hit: SearchHit) {
    rememberHit(hit);
    setPeekHit(hit);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSource(s.id);
              setQ("");
              setCats([]);
              setIncludeTag("");
              setExcludeTag("");
            }}
            className={cn(
              "h-9 rounded-sm px-3 text-sm font-medium",
              source === s.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <section className="relative mb-5 overflow-hidden rounded-xl border border-border">
        <img src="/palworld-cover.jpg" alt="" className="h-44 w-full object-cover sm:h-56" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Palworld mods</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Discover</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {live ? "Live from the stores with your API keys." : note || "Cached catalog until a store answers."}
          </p>
        </div>
      </section>

      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mods, authors, or paste a store URL" className="pl-9" />
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>

      {source === "steam" ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Input value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder="Workshop file id" className="max-w-xs" />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!workshopId.trim()) {
                toast.error("Paste a Workshop id");
                return;
              }
              const root = paths.server || paths.client;
              if (!root) {
                toast.error("Set a Palworld or PalServer folder in Settings first.");
                return;
              }
              void steamcmdWorkshop(root, workshopId.trim());
              log({ level: "ok", source: "mods", message: `Queued Workshop ${workshopId.trim()} via SteamCMD.` });
              toast.success("SteamCMD workshop download queued");
            }}
          >
            SteamCMD pull
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-border bg-card p-3 h-fit">
          <p className="mb-2 px-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">Categories</p>
          <button
            type="button"
            onClick={() => setCats([])}
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
              cats.length === 0 ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
            <span className="font-mono text-xs">{hits.length}</span>
          </button>
          <ul className="mt-1 max-h-[70vh] overflow-auto">
            {catRows.map((c) => {
              const on = cats.includes(c.name);
              return (
                <li key={c.name}>
                  <button
                    type="button"
                    onClick={() => setCats(on ? cats.filter((x) => x !== c.name) : [...cats, c.name])}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                      on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-xs">{c.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {tagOptions.length ? (
              <>
                <Select value={includeTag || "any"} onValueChange={(v) => setIncludeTag(v === "any" ? "" : v)}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Include tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any tag</SelectItem>
                    {tagOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={excludeTag || "none"} onValueChange={(v) => setExcludeTag(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Exclude tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No exclude</SelectItem>
                    {tagOptions.map((t) => (
                      <SelectItem key={`x-${t}`} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            ) : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as DiscoverPeriod)}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as DiscoverSort)}>
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dir} onValueChange={(v) => setDir(v as "asc" | "desc")}>
                <SelectTrigger className="h-9 w-[92px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Desc</SelectItem>
                  <SelectItem value="asc">Asc</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 Items</SelectItem>
                  <SelectItem value="40">40 Items</SelectItem>
                </SelectContent>
              </Select>
              <span className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                <LayoutGrid className="size-4" />
              </span>
            </div>
          </div>

          {period === "custom" ? (
            <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
              <label className="text-xs text-muted-foreground">
                From
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9" />
              </label>
              <label className="text-xs text-muted-foreground">
                To
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9" />
              </label>
              <Button type="button" size="sm" onClick={() => void runSearch()}>
                Go
              </Button>
            </div>
          ) : null}

          {busy && visible.length === 0 && hits.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-lg bg-card" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No packs match these filters. Try All time, another source, or paste a store URL.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {visible.map((hit) => (
                <ModCard
                  key={`${hit.source}-${hit.sourceId}-${hit.id}`}
                  hit={hit}
                  onRemember={() => remember(hit)}
                  onQuick={() => {
                    installHit(hit, mode === "client" ? "client" : mode === "server" ? "server" : "both");
                    toast.success(`${hit.name} queued`);
                  }}
                />
              ))}
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {safePage} of {pageCount} · {filtered.length} mods
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage(1)}>
                  First
                </Button>
                <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                  Next
                </Button>
                <Button size="sm" variant="outline" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>
                  Last
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function timeAgoWords(iso?: string) {
  if (!iso) return "";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function ModCard({ hit, onRemember, onQuick }: { hit: SearchHit; onRemember: () => void; onQuick: () => void }) {
  const hrefId = discoverPathId(hit.source, hit.sourceId);
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Link to="/discover/$modId" params={{ modId: hrefId }} onClick={onRemember} className="block min-w-0 text-left">
        <div className="relative aspect-[16/10] bg-muted">
          <img src={hit.image || "/palworld-cover.jpg"} alt="" className="size-full object-cover" />
        </div>
        <div className="p-3">
          <h2 className="line-clamp-2 font-medium tracking-tight hover:text-primary">{hit.name}</h2>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground">
              {(hit.author || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate">{hit.author}</span>
          </p>
          <p className="mt-2 text-xs font-medium text-foreground/80">{normalizeCategory(hit.category)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {timeAgoWords(hit.publishedAt || hit.updatedAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {formatDayLong(hit.publishedAt || hit.updatedAt)}
            </span>
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{hit.description}</p>
        </div>
      </Link>
      <div className="mt-auto flex items-center gap-3 px-3 pb-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp className="size-3.5" />
          {formatCount(hit.endorsements || 0)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Download className="size-3.5" />
          {formatCount(hit.uniqueDownloads || hit.downloads || 0)}
        </span>
        <span className="inline-flex items-center gap-1">
          <HardDrive className="size-3.5" />
          {formatSizePretty(hit.sizeKb)}
        </span>
        <Badge variant="outline" className="ml-auto">
          {hit.source === "nexus" ? "Nexus" : hit.source === "steam" ? "Steam" : "Curse"}
        </Badge>
      </div>
      <div className="flex gap-2 border-t border-border px-3 py-2">
        <Button size="sm" className="flex-1" asChild>
          <Link to="/discover/$modId" params={{ modId: hrefId }} onClick={onRemember}>
            Full view
          </Link>
        </Button>
        <Button size="sm" variant="outline" onClick={onQuick}>
          Quick add
        </Button>
      </div>
    </article>
  );
}
