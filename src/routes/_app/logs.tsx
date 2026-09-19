import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LiveConsole } from "@/components/live-console";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { formatStamp } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/logs")({ component: LogsPage });

function LogsPage() {
  const logs = useAppStore((s) => s.logs);
  const clearLogs = useAppStore((s) => s.clearLogs);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<"all" | "ok" | "info" | "warn" | "error">("all");
  const filtered = useMemo(
    () =>
      logs.filter((l) => {
        if (level !== "all" && l.level !== level) return false;
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return l.message.toLowerCase().includes(s) || l.source.toLowerCase().includes(s);
      }),
    [logs, q, level],
  );

  return (
    <div>
      <PageHeader
        title="Logs"
        description="Live PalServer console, crash watchdog, REST joins, and Palnest actions in one world journal."
        actions={
          <Button variant="outline" onClick={clearLogs}>
            Clear journal
          </Button>
        }
      />
      <div className="mb-6">
        <LiveConsole />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
          {(["all", "error", "warn", "ok", "info"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLevel(l)}
              className={cn(
                "h-9 rounded-sm px-3 text-sm font-medium capitalize",
                level === l ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter journal" className="sm:max-w-xs sm:ml-auto" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Journal is empty.</p>
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
