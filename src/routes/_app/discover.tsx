import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { searchMods } from "@/lib/releases";
import { catalogToHit, searchCatalog } from "@/lib/catalog";
import { kindLabel, sourceLabel } from "@/lib/paths";
import { steamcmdWorkshop } from "@/lib/runtime";
import { cn, formatCount } from "@/lib/utils";
import type { InstallTarget, ModSource, SearchHit } from "@/lib/types";

export const Route = createFileRoute("/_app/discover")({ component: DiscoverPage });

const SOURCES: { id: ModSource; label: string; hint: string }[] = [
  { id: "nexus", label: "Nexus", hint: "Primary Palworld catalog" },
  { id: "steam", label: "Steam", hint: "Workshop app 1623730" },
  { id: "curseforge", label: "CurseForge", hint: "Plus the Palnest index" },
];

function DiscoverPage() {
  const keys = useAppStore((s) => s.keys);
  const mode = useAppStore((s) => s.mode);
  const installHit = useAppStore((s) => s.installHit);
  const [source, setSource] = useState<ModSource>("nexus");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>(() => searchCatalog("", "nexus").map(catalogToHit));
  const [note, setNote] = useState("Index is local until you add an API key.");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [workshopId, setWorkshopId] = useState("");
  const paths = useAppStore((s) => s.paths);
  const log = useAppStore((s) => s.log);

  async function runSearch(nextSource = source, query = q) {
    setBusy(true);
    try {
      const res = await searchMods({
        data: {
          query,
          source: nextSource,
          nexusKey: keys.nexus || undefined,
          steamKey: keys.steam || undefined,
          curseforgeKey: keys.curseforge || undefined,
        },
      });
      setHits(res.hits);
      setLive(res.live);
      setNote(res.note || (res.live ? "Live results mixed with the Palnest index." : "Palnest index"));
    } catch {
      const fallback = searchCatalog(query, nextSource).map(catalogToHit);
      setHits(fallback);
      setLive(false);
      setNote("Lookup failed. Showing the Palnest index.");
    } finally {
      setBusy(false);
    }
  }

  function add(hit: SearchHit, target: InstallTarget) {
    installHit(hit, target);
    toast.success(`${hit.name} queued on ${target}`);
  }

  const defaultTarget: InstallTarget = mode === "client" ? "client" : mode === "server" ? "server" : "both";

  return (
    <div>
      <PageHeader
        title="Discover"
        description="Add and update mods from Nexus, Steam Workshop, and CurseForge. Keys live only in this browser."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSource(s.id);
                void runSearch(s.id, q);
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
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, mod id, or Nexus / Steam / CurseForge URL"
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Searching" : "Search"}
          </Button>
        </form>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {live ? "Live API" : "Index"} · {note} Search by name, numeric id, or a store URL.
      </p>
      {source === "steam" ? (
        <form
          className="mb-5 flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            const id = workshopId.trim();
            if (!id) {
              toast.error("Workshop item id required");
              return;
            }
            void steamcmdWorkshop(paths.server || paths.client || "C:\\PalServers\\PalServer", id);
            log({ level: "ok", source: "steamcmd", message: `Pulled Workshop ${id}.` });
            toast.success(`Workshop ${id} queued via SteamCMD`);
            setWorkshopId("");
          }}
        >
          <p className="shrink-0 text-sm">SteamCMD pull</p>
          <Input value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} placeholder="1623730 item id" />
          <Button type="submit">workshop_download_item</Button>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {hits.map((hit) => (
          <article key={hit.id} className="flex flex-col rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-medium tracking-tight">{hit.name}</h2>
              <Badge variant="outline">{sourceLabel(hit.source)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{hit.author}</p>
            <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{hit.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{kindLabel(hit.kind)}</Badge>
              <span className="font-mono">{hit.version}</span>
              {hit.downloads > 0 ? <span>{formatCount(hit.downloads)} dl</span> : null}
              {!hit.serverCompatible ? <span>Client only</span> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => add(hit, defaultTarget)}>
                Add to {defaultTarget}
              </Button>
              {mode === "both" ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => add(hit, "client")}>
                    Client
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => add(hit, "server")}>
                    Server
                  </Button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
