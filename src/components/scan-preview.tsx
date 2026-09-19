import { kindLabel } from "@/lib/paths";
import { scanSummary, type ScanResult } from "@/lib/scan";
import { cn } from "@/lib/utils";

export function ScanPreview({ result }: { result: ScanResult | null }) {
  if (!result) return null;
  const sum = scanSummary(result);
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-sm font-medium">{sum.label}</p>
      {sum.broken ? <p className="mt-1 text-xs text-warn">{sum.broken} look broken or incomplete.</p> : null}
      {result.mods.length ? (
        <ul className="mt-2 max-h-44 space-y-1 overflow-auto text-sm">
          {result.mods.map((m) => (
            <li key={`${m.kind}-${m.slug}`} className="flex items-baseline justify-between gap-3">
              <span className={cn("min-w-0 truncate", m.broken && "text-warn")}>{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {kindLabel(m.kind)}
                {m.enabled ? "" : " · off"}
                {m.broken ? " · broken" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the Palworld or PalServer folder (not a single file) so Palnest can see ue4ss/Mods and Paks/~mods.
        </p>
      )}
    </div>
  );
}
