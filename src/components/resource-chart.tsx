import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryRange, MetricSample } from "@/lib/monitor";
import { downsample, filterRange, summarize } from "@/lib/monitor";
import { cn } from "@/lib/utils";

const RANGES: HistoryRange[] = ["15m", "1h", "6h"];

export function ResourceChart({
  samples,
  range,
  onRange,
  live,
  compact,
  showFps,
}: {
  samples: MetricSample[];
  range: HistoryRange;
  onRange: (r: HistoryRange) => void;
  live?: boolean;
  compact?: boolean;
  showFps?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const slice = filterRange(samples, range);
  const stats = summarize(slice);
  const t0 = slice[0]?.t ?? 0;
  const data = useMemo(
    () =>
      downsample(slice).map((s) => ({
        x: s.t - t0,
        at: s.t,
        cpu: s.running ? s.procCpu : 0,
        ram: s.running ? s.procRamGb : 0,
        fps: s.fps,
        restart: Boolean(s.restart),
      })),
    [slice, t0],
  );
  const restarts = data.filter((d) => d.restart).map((d) => d.x);

  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-5", compact && "p-4")}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Resource history</p>
            {live ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-ok">
                <span className="size-1.5 rounded-full bg-ok" />
                Live
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Idle</span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            PalServer CPU and memory. Gaps are stops; amber ticks are restarts.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRange(r)}
              className={cn(
                "h-11 min-w-11 rounded-sm px-3 text-sm font-medium",
                range === r ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-40 w-full min-w-0">
        {mounted && data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-muted-foreground)" strokeOpacity={0.18} vertical={false} />
              <XAxis
                dataKey="x"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(x: number) => formatTick(t0 + x)}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                yAxisId="cpu"
                domain={[0, 100]}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <YAxis yAxisId="ram" domain={[0, 20]} hide />
              {showFps ? <YAxis yAxisId="fps" domain={[0, 32]} hide /> : null}
              <Tooltip content={<ChartTip showFps={showFps} />} />
              {restarts.map((t) => (
                <ReferenceLine key={t} x={t} yAxisId="cpu" stroke="var(--color-warn)" strokeDasharray="3 4" />
              ))}
              <Area
                yAxisId="cpu"
                type="monotone"
                dataKey="cpu"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.28}
                strokeWidth={2.25}
                isAnimationActive={false}
                name="CPU"
              />
              <Line
                yAxisId="ram"
                type="monotone"
                dataKey="ram"
                stroke="var(--color-foreground)"
                strokeOpacity={0.55}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="RAM"
              />
              {showFps ? (
                <Line
                  yAxisId="fps"
                  type="monotone"
                  dataKey="fps"
                  stroke="var(--color-ok)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                  name="FPS"
                  connectNulls={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {data.length > 1 ? "Loading chart…" : "No samples yet. Start the dedicated server."}
          </div>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="CPU avg" value={`${stats.cpuAvg.toFixed(0)}%`} />
        <Stat label="CPU peak" value={`${stats.cpuPeak.toFixed(0)}%`} />
        <Stat label="RAM avg" value={`${stats.ramAvg.toFixed(1)} GB`} />
        <Stat label="RAM peak" value={`${stats.ramPeak.toFixed(1)} GB`} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="text-primary">Teal</span> is PalServer CPU. Grey is process RAM
        {showFps ? ". Green is sim FPS from /v1/api/metrics." : ". REST FPS lives on its own gauge."}
      </p>
    </section>
  );
}

export default ResourceChart;

function formatTick(t: number) {
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ChartTip({
  active,
  payload,
  showFps,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { at?: number } }[];
  showFps?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const at = payload[0]?.payload?.at;
  const cpu = payload.find((p) => p.name === "CPU")?.value;
  const ram = payload.find((p) => p.name === "RAM")?.value;
  const fps = payload.find((p) => p.name === "FPS")?.value;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-border">
      <p className="text-muted-foreground">{at ? formatTick(at) : ""}</p>
      <p className="mt-1 tabular-nums text-foreground">CPU {cpu?.toFixed?.(0) ?? "—"}%</p>
      <p className="tabular-nums text-muted-foreground">RAM {ram?.toFixed?.(1) ?? "—"} GB</p>
      {showFps ? <p className="tabular-nums text-ok">FPS {fps != null ? Number(fps).toFixed(1) : "—"}</p> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
