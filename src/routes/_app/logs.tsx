import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LiveConsole } from "@/components/live-console";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadText } from "@/lib/download";
import { useAppStore } from "@/lib/store";
import { cn, formatStamp } from "@/lib/utils";

export const Route = createFileRoute("/_app/logs")({ component: LogsPage });

const SOURCES = [
  { id: "app", label: "App" },
  { id: "activity", label: "Activity" },
  { id: "server", label: "Server console" },
  { id: "client-ue4ss", label: "Client UE4SS" },
  { id: "server-ue4ss", label: "Server UE4SS" },
  { id: "pal", label: "Server (Pal.log)" },
] as const;

type SourceId = (typeof SOURCES)[number]["id"] | "all";

function sourceOf(raw: string): SourceId {
  const s = raw.toLowerCase();
  if (s === "app" || s === "schedule" || s === "disk") return "app";
  if (s === "activity" || s === "rest" || s === "playit" || s === "fleet" || s === "ban") return "activity";
  if (s === "client-ue4ss") return "client-ue4ss";
  if (s === "server-ue4ss" || s === "ue4ss") return "server-ue4ss";
  if (s === "pal" || s === "checker") return "pal";
  return "server";
}

function LogsPage() {
  const logs = useAppStore((s) => s.logs);
  const consoleLines = useAppStore((s) => s.consoleLines);
  const server = useAppStore((s) => s.server);
  const mode = useAppStore((s) => s.mode);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<SourceId>("app");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [follow, setFollow] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  const visibleSources = SOURCES.filter((s) => {
    if (mode === "client" && (s.id === "server" || s.id === "server-ue4ss" || s.id === "pal")) return false;
    if (mode === "server" && s.id === "client-ue4ss") return false;
    return true;
  });

  const journal = useMemo(() => {
    const extra =
      source === "server"
        ? (consoleLines[server.id] ?? []).map((c) => ({
            id: c.id,
            ts: c.ts,
            level: c.stream === "err" ? ("error" as const) : ("info" as const),
            source: "server",
            message: c.text,
          }))
        : [];
    return [...extra, ...logs];
  }, [logs, consoleLines, server.id, source]);

  const filtered = useMemo(
    () =>
      journal.filter((l) => {
        if (source !== "all" && sourceOf(l.source) !== source) return false;
        if (errorsOnly && l.level !== "error" && l.level !== "warn") return false;
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return l.message.toLowerCase().includes(s) || l.source.toLowerCase().includes(s);
      }),
    [journal, q, source, errorsOnly],
  );

  const errors = filtered.filter((l) => l.level === "error").length;
  const warns = filtered.filter((l) => l.level === "warn").length;
  const infos = filtered.length - errors - warns;

  useEffect(() => {
    if (!follow) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [filtered.length, follow]);

  return (
    <div>
      <PageHeader
        title="Logs"
        description="App journal, activity, PalServer console, and UE4SS output in one place. Export the visible lines when you file a bug."
        actions={
          <Button variant="outline" onClick={clearLogs}>
            Clear journal
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1 rounded-md bg-muted p-1">
        {visibleSources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSource(s.id)}
            className={cn(
              "h-9 rounded-sm px-3 text-sm font-medium",
              source === s.id ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {source === "server" ? (
        <div className="mb-4">
          <LiveConsole />
        </div>
      ) : null}
      <p className="mb-2 font-mono text-xs text-muted-foreground">
        {source === "app"
          ? "Palnest\\Logs\\app.log"
          : source === "client-ue4ss"
            ? "Client\\Pal\\Binaries\\Win64\\ue4ss\\UE4SS.log"
            : source === "server-ue4ss"
              ? "PalServer\\Pal\\Binaries\\Win64\\ue4ss\\UE4SS.log"
              : source === "pal"
                ? "PalServer\\Pal\\Saved\\Logs\\Pal.log"
                : "Palnest journal"}
      </p>
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter visible lines" className="lg:max-w-sm" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
          Errors & warnings only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow
        </label>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const text = filtered.map((l) => `${l.ts} [${l.level}] ${l.source} ${l.message}`).join("\n");
              downloadText(text || " ", `palnest-${source}.log`);
              toast.success("Exported visible lines");
            }}
          >
            Export visible
          </Button>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {filtered.length} lines · {errors} errors
        <span className="ml-3 inline-flex gap-2">
          <Badge variant="danger">Errors {errors}</Badge>
          <Badge variant="warn">Warnings {warns}</Badge>
          <Badge variant="outline">Info {infos}</Badge>
        </span>
      </p>
      <div ref={scroller} className="max-h-[640px] overflow-auto rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {source === "client-ue4ss" || source === "server-ue4ss" || source === "pal"
              ? "No live tail yet. Palnest.exe follows UE4SS.log and Pal.log when those files exist next to the game or PalServer."
              : "No lines for this source."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{formatStamp(l.ts)}</span>
                <Badge
                  variant={l.level === "error" ? "danger" : l.level === "warn" ? "warn" : l.level === "ok" ? "ok" : "default"}
                >
                  {l.source}
                </Badge>
                <p className="text-sm">{l.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
