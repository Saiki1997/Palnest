import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store";
import { cn, formatStamp } from "@/lib/utils";

export function LiveConsole({
  serverId,
  compact,
}: {
  serverId?: string;
  compact?: boolean;
}) {
  const consoleLines = useAppStore((s) => s.consoleLines);
  const activeId = useAppStore((s) => s.activeServerId);
  const clearConsole = useAppStore((s) => s.clearConsole);
  const captureConsole = useAppStore((s) => s.captureConsole);
  const [q, setQ] = useState("");
  const id = serverId || activeId;
  const rows = consoleLines?.[id] ?? [];
  const filtered = useMemo(() => {
    const list = [...rows].slice(compact ? -8 : 0);
    if (!q.trim()) return list;
    const s = q.toLowerCase();
    return list.filter((l) => l.text.toLowerCase().includes(s));
  }, [rows, q, compact]);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-medium">Live console</h2>
          <p className="text-xs text-muted-foreground">
            {captureConsole ? "PalServer stdout, REST, and Palnest spawn notes." : "Console capture is off in Settings."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compact ? (
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-9 w-40" />
          ) : null}
          <Button size="sm" variant="outline" onClick={() => clearConsole(id)}>
            Clear
          </Button>
        </div>
      </div>
      <div className={cn("font-mono text-xs leading-relaxed", compact ? "max-h-48 overflow-y-auto p-3" : "max-h-[28rem] overflow-y-auto p-4")}>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground">No console yet. Start the world to attach PalServer.</p>
        ) : (
          <ul className="space-y-1">
            {filtered.map((line) => (
              <li key={line.id} className={cn(line.stream === "err" ? "text-danger" : "text-foreground")}>
                <span className="mr-2 text-muted-foreground">{formatStamp(line.ts).slice(-8)}</span>
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
