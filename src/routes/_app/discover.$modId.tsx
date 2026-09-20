import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Clock, Download, ExternalLink, HardDrive, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModDescription } from "@/components/mod-description";
import { CATALOG, catalogToHit } from "@/lib/catalog";
import { filesForHit, kindFolderNote } from "@/lib/mod-kind";
import { normalizeCategory } from "@/lib/mod-meta";
import { discoverPathId, parseDiscoverId } from "@/lib/mod-query";
import { kindLabel, sourceLabel } from "@/lib/paths";
import { fetchModDetail } from "@/lib/releases";
import { useAppStore } from "@/lib/store";
import { cn, formatCount, formatDayLong, formatSizePretty, timeAgo } from "@/lib/utils";
import type { InstallTarget, ModFileChoice, ModSource, SearchHit } from "@/lib/types";

export const Route = createFileRoute("/_app/discover/$modId")({
  component: ModFullView,
});

function findCachedHit(modId: string): SearchHit | null {
  const decoded = decodeURIComponent(modId);
  const parsed = parseDiscoverId(modId);
  const state = useAppStore.getState();
  if (state.peekHit) {
    const peek = state.peekHit;
    if (
      peek.id === decoded ||
      peek.sourceId === parsed.sourceId ||
      (parsed.source && peek.source === parsed.source && peek.sourceId === parsed.sourceId) ||
      decoded === discoverPathId(peek.source, peek.sourceId)
    ) {
      return peek;
    }
  }
  for (const bucket of Object.values(state.modCache)) {
    const hit = bucket?.hits.find(
      (h) =>
        h.id === decoded ||
        h.id === modId ||
        h.sourceId === decoded ||
        h.sourceId === parsed.sourceId ||
        (parsed.source && h.source === parsed.source && h.sourceId === parsed.sourceId),
    );
    if (hit) return hit;
  }
  const catalog = CATALOG.find(
    (m) =>
      m.id === decoded ||
      m.sourceId === decoded ||
      m.sourceId === parsed.sourceId ||
      (parsed.source && m.source === parsed.source && m.sourceId === parsed.sourceId),
  );
  return catalog ? catalogToHit(catalog) : null;
}

function seedFromParam(modId: string): SearchHit | null {
  const cached = findCachedHit(modId);
  if (cached) return cached;
  const parsed = parseDiscoverId(modId);
  if (!parsed.source || !parsed.sourceId) return null;
  return {
    id: discoverPathId(parsed.source, parsed.sourceId),
    name: `${sourceLabel(parsed.source)} ${parsed.sourceId}`,
    author: sourceLabel(parsed.source),
    version: "—",
    source: parsed.source,
    sourceId: parsed.sourceId,
    url: parsed.source === "nexus"
      ? `https://www.nexusmods.com/palworld/mods/${parsed.sourceId}`
      : parsed.source === "steam"
        ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${parsed.sourceId}`
        : `https://www.curseforge.com/palworld/mods/${parsed.sourceId}`,
    downloads: 0,
    description: "Loading the store page and file list…",
    kind: "pak",
    updatedAt: new Date().toISOString(),
    serverCompatible: true,
    gameVersions: [],
    requires: [],
  };
}

function ModFullView() {
  const { modId } = Route.useParams();
  const keys = useAppStore((s) => s.keys);
  const mode = useAppStore((s) => s.mode);
  const installHit = useAppStore((s) => s.installHit);
  const rememberHit = useAppStore((s) => s.rememberHit);
  const seed = useMemo(() => seedFromParam(modId), [modId]);
  const [hit, setHit] = useState<SearchHit | null>(seed);
  const [files, setFiles] = useState<ModFileChoice[]>(seed?.files ?? (seed ? filesForHit(seed) : []));
  const [selected, setSelected] = useState(files.find((f) => f.primary)?.id ?? files[0]?.id ?? "");
  const [note, setNote] = useState("Loading store page and files…");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState("description");

  useEffect(() => {
    const local = seedFromParam(modId);
    if (local) {
      setHit(local);
      const localFiles = local.files?.length ? local.files : filesForHit(local);
      setFiles(localFiles);
      setSelected(localFiles.find((f) => f.primary)?.id ?? localFiles[0]?.id ?? "");
    }
    const parsed = parseDiscoverId(modId);
    const source = (local?.source || parsed.source) as ModSource | undefined;
    const sourceId = local?.sourceId || parsed.sourceId;
    if (!source || !sourceId) {
      setBusy(false);
      setNote("That pack is not in the cache yet. Go back to Discover and open it from a card.");
      return;
    }
    let alive = true;
    setBusy(true);
    void fetchModDetail({
      data: {
        id: local?.id,
        source,
        sourceId,
        name: local?.name,
        kind: local?.kind,
        nexusKey: keys.nexus || undefined,
        curseforgeKey: keys.curseforge || undefined,
        steamKey: keys.steam || undefined,
      },
    })
      .then((res) => {
        if (!alive || !res.hit) return;
        setHit(res.hit);
        const nextFiles = res.files.length ? res.files : res.hit.files ?? filesForHit(res.hit);
        setFiles(nextFiles);
        setSelected(nextFiles.find((f) => f.primary)?.id ?? nextFiles[0]?.id ?? "");
        setLive(res.live);
        setNote(res.note || (res.live ? "Live store page + files." : "Cached Palnest index."));
        rememberHit(res.hit);
        if (nextFiles.length) setTab("files");
      })
      .catch(() => {
        if (!alive) return;
        setNote("Store lookup failed. Showing the cached page — pick a file below.");
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [modId, keys.nexus, keys.curseforge, keys.steam, rememberHit]);

  const defaultTarget: InstallTarget = mode === "client" ? "client" : mode === "server" ? "server" : "both";
  const file = files.find((f) => f.id === selected) ?? files[0];

  function install(target: InstallTarget) {
    if (!hit || !file) {
      toast.error("Pick a file first.");
      return;
    }
    installHit(hit, target, file);
    toast.success(`${file.name} → ${kindLabel(file.kind)} on ${target}`);
  }

  if (!hit) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-muted-foreground">That pack is not in the cache yet. Open Discover and search first.</p>
        <Button className="mt-4" asChild>
          <Link to="/discover">Back to Discover</Link>
        </Button>
      </div>
    );
  }

  const body = hit.body || hit.description;
  const grouped = groupFiles(files);
  const needsKey =
    !live &&
    ((hit.source === "nexus" && !keys.nexus) ||
      (hit.source === "curseforge" && !keys.curseforge) ||
      (hit.source === "steam" && !keys.steam));

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-4 text-xs tracking-wide text-muted-foreground uppercase">
        Home › Palworld › Mods › {hit.name}
      </p>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/discover">
            <ArrowLeft className="size-4" />
            Discover
          </Link>
        </Button>
        <Badge variant="outline">{sourceLabel(hit.source)}</Badge>
        {live ? <Badge variant="ok">Live</Badge> : <Badge variant="outline">Cached</Badge>}
        {busy ? <span className="text-xs text-muted-foreground">Refreshing files…</span> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="relative aspect-[16/9] bg-muted">
            {hit.image ? (
              <img src={hit.image} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-end bg-[radial-gradient(circle_at_20%_20%,rgb(78_201_196/0.18),transparent_45%),linear-gradient(180deg,#10202a,#071018)] p-5">
                <p className="text-2xl font-semibold tracking-tight">{hit.name}</p>
              </div>
            )}
          </div>
        </div>
        <header className="flex min-w-0 flex-col justify-between gap-4">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{normalizeCategory(hit.category)}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{hit.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {hit.author} · {hit.version}
            </p>
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {hit.publishedAt ? (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {timeAgo(hit.publishedAt)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDayLong(hit.publishedAt || hit.updatedAt)}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="size-4" />
                {formatCount(hit.endorsements || 0)} endorsements
              </span>
              <span className="inline-flex items-center gap-1">
                <Download className="size-4" />
                {formatCount(hit.uniqueDownloads || hit.downloads || 0)} downloads
              </span>
              <span className="inline-flex items-center gap-1">
                <HardDrive className="size-4" />
                {formatSizePretty(hit.sizeKb)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{note}</p>
            {needsKey ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Add the {sourceLabel(hit.source)} API key in{" "}
                <Link to="/settings" className="text-primary hover:underline">
                  Settings
                </Link>{" "}
                to load the live description and every installable file.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => install(defaultTarget)} disabled={!file}>
              Install {file ? file.name : "selected file"} to {defaultTarget}
            </Button>
            <Button variant="outline" asChild>
              <a href={hit.url} target="_blank" rel="noreferrer">
                Open on {sourceLabel(hit.source)}
                <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
        </header>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="description">Description</TabsTrigger>
          <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="description" className="mt-5">
          <ModDescription text={body} />
          {hit.requires?.length ? <p className="mt-3 text-sm text-muted-foreground">Requires {hit.requires.join(", ")}.</p> : null}
          {!hit.serverCompatible ? (
            <Badge variant="warn" className="mt-3">
              Client only
            </Badge>
          ) : null}
        </TabsContent>
        <TabsContent value="files" className="mt-5">
          <p className="mb-4 text-sm text-muted-foreground">
            Pick the archive Palnest should drop. PAK → ~mods. Lua → UE4SS Mods. PalSchema JSON → PalSchema/mods.
          </p>
          {files.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              No files yet. Add the {sourceLabel(hit.source)} API key in Settings, then reopen this page.
            </p>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</h3>
                  <ul className="space-y-2">
                    {group.files.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(f.id)}
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left",
                            selected === f.id ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-1.5 size-2.5 shrink-0 rounded-full",
                              selected === f.id ? "bg-primary" : "bg-muted-foreground/40",
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{f.name}</span>
                              <Badge variant="outline">{kindLabel(f.kind)}</Badge>
                              {f.category ? <Badge variant="outline">{f.category}</Badge> : null}
                              {f.primary ? <Badge variant="ok">Main</Badge> : null}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {f.version ? <span>v{f.version}</span> : null}
                              <span>{formatSizePretty(f.sizeKb)}</span>
                              {f.uploadedAt ? (
                                <span>
                                  {timeAgo(f.uploadedAt)} · {formatDayLong(f.uploadedAt)}
                                </span>
                              ) : null}
                              <span>{f.note || kindFolderNote(f.kind)}</span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => install(defaultTarget)} disabled={!file}>
              Install {file ? kindLabel(file.kind) : ""} to {defaultTarget}
            </Button>
            {mode === "both" ? (
              <>
                <Button variant="outline" onClick={() => install("client")} disabled={!file}>
                  Client
                </Button>
                <Button variant="outline" onClick={() => install("server")} disabled={!file}>
                  Server
                </Button>
              </>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function groupFiles(files: ModFileChoice[]) {
  const order = ["MAIN", "OPTIONAL", "UPDATE", "MISCELLANEOUS"];
  const buckets = new Map<string, ModFileChoice[]>();
  for (const f of files) {
    const label = (f.category || "MAIN").toUpperCase();
    const key = order.includes(label) ? label : label || "MAIN";
    const list = buckets.get(key) ?? [];
    list.push(f);
    buckets.set(key, list);
  }
  const labels = [...order.filter((k) => buckets.has(k)), ...[...buckets.keys()].filter((k) => !order.includes(k))];
  return labels.map((label) => ({ label, files: buckets.get(label) ?? [] }));
}
