import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricSample } from "@/lib/monitor";
import { downsample, filterRange } from "@/lib/monitor";
import { cn } from "@/lib/utils";

export const HOST_RAM_GB = 16;

export function ramFromPct(pct: number) {
  return Number(((pct / 100) * HOST_RAM_GB).toFixed(1));
}

function formatTick(t: number) {
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function CpuLoadChart({
  samples,
  live,
}: {
  samples: MetricSample[];
  live?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const slice = filterRange(samples, "1h");
  const t0 = slice[0]?.t ?? 0;
  const data = useMemo(
    () =>
      downsample(slice).map((s) => ({
        x: s.t - t0,
        at: s.t,
        cpu: Number(s.hostCpu.toFixed(1)),
      })),
    [slice, t0],
  );
  const cpus = data.map((d) => d.cpu);
  const min = cpus.length ? Math.min(...cpus) : 0;
  const max = cpus.length ? Math.max(...cpus) : 0;
  const avg = cpus.length ? cpus.reduce((a, b) => a + b, 0) / cpus.length : 0;
  const latest = samples[samples.length - 1]?.hostCpu ?? 0;
  const last = data[data.length - 1];

  return (
    <section className="dash-glass rounded-xl p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-chart-cpu" />
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">System CPU load</p>
        </div>
        <p className="font-mono text-lg font-medium tabular-nums text-chart-cpu">{latest.toFixed(0)} %</p>
      </div>
      <div className="h-36 w-full min-w-0">
        {mounted && data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as { at?: number; cpu?: number };
                  return (
                    <div className="rounded-md bg-card px-3 py-2 text-xs shadow-[var(--shadow-border)]">
                      <p className="text-muted-foreground">{row.at ? formatTick(row.at) : ""}</p>
                      <p className="mt-1 font-mono tabular-nums text-chart-cpu">{row.cpu?.toFixed(0)}%</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="var(--color-chart-cpu)"
                fill="var(--color-chart-cpu)"
                fillOpacity={0.28}
                strokeWidth={2.25}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-chart-cpu)", stroke: "none" }}
              />
              {last ? (
                <ReferenceDot
                  x={last.x}
                  y={last.cpu}
                  r={5}
                  fill="var(--color-chart-cpu)"
                  stroke="var(--color-background)"
                  strokeWidth={2}
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Waiting for host samples.</div>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div>
          <dt className="uppercase tracking-widest">Min</dt>
          <dd className="font-mono tabular-nums text-foreground">{min.toFixed(1)}</dd>
        </div>
        <div className="text-center">
          <dt className="uppercase tracking-widest">Avg</dt>
          <dd className="font-mono tabular-nums text-foreground">{avg.toFixed(1)}</dd>
        </div>
        <div className="text-right">
          <dt className="uppercase tracking-widest">Max</dt>
          <dd className="font-mono tabular-nums text-foreground">{max.toFixed(1)}</dd>
        </div>
      </dl>
      {live ? <p className="sr-only">Live CPU</p> : null}
    </section>
  );
}

export function RamLoadBar({ samples }: { samples: MetricSample[] }) {
  const slice = filterRange(samples, "1h");
  const latest = samples[samples.length - 1];
  const pct = latest?.hostRamPct ?? 0;
  const gb = ramFromPct(pct);
  const ramVals = slice.map((s) => ramFromPct(s.hostRamPct));
  const min = ramVals.length ? Math.min(...ramVals) : 0;
  const avg = ramVals.length ? ramVals.reduce((a, b) => a + b, 0) / ramVals.length : 0;
  const width = Math.min(100, Math.max(3, pct));

  return (
    <section className="dash-glass flex flex-col rounded-xl p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-chart-ram" />
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">System RAM load</p>
        </div>
        <p className="font-mono text-lg font-medium tabular-nums text-chart-ram">{gb.toFixed(1)} GB</p>
      </div>
      <div className="mt-8 flex flex-1 flex-col justify-center">
        <div className="relative h-2 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-chart-ram"
            style={{ width: `${width}%` }}
          />
          <span
            className={cn(
              "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-ram chart-orb-ram",
            )}
            style={{ left: `${width}%` }}
          />
        </div>
      </div>
      <dl className="mt-8 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
        <div>
          <dt className="uppercase tracking-widest">Min</dt>
          <dd className="font-mono tabular-nums text-foreground">{min.toFixed(1)}</dd>
        </div>
        <div className="text-center">
          <dt className="uppercase tracking-widest">Avg</dt>
          <dd className="font-mono tabular-nums text-foreground">{avg.toFixed(1)}</dd>
        </div>
        <div className="text-right">
          <dt className="uppercase tracking-widest">Max</dt>
          <dd className="font-mono tabular-nums text-foreground">{HOST_RAM_GB.toFixed(1)}</dd>
        </div>
      </dl>
    </section>
  );
}
