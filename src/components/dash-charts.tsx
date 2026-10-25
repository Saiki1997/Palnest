import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricSample } from "@/lib/monitor";
import { downsample, filterRange, HOST_RAM_GB, ramFromPct } from "@/lib/monitor";

function formatTick(t: number) {
  return new Date(t).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

type Point = { at: number; value: number };

/** One-hour host load chart. Both charts share it so they read as a pair. */
function LoadChart({
  title,
  points,
  current,
  unit,
  max,
  color,
  stats,
}: {
  title: string;
  points: Point[];
  current: string;
  unit: string;
  max: number;
  color: string;
  stats: { label: string; value: string }[];
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const gradientId = `fill-${title.replace(/\W/g, "")}`;

  return (
    <section className="panel flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: color }} />
          <h2 className="text-[13px] font-medium">{title}</h2>
          <span className="text-xs text-muted-foreground">last hour</span>
        </div>
        <p className="font-mono text-base font-medium tabular-nums">
          {current}
          <span className="ml-0.5 text-xs text-muted-foreground">{unit}</span>
        </p>
      </div>
      <div className="mt-3 h-32 w-full min-w-0">
        {mounted && points.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={points} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis domain={[0, max]} hide />
              <Tooltip
                cursor={{ stroke: "var(--color-border)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as Point;
                  return (
                    <div className="rounded-md bg-card px-2.5 py-1.5 text-xs shadow-[var(--shadow-pop)]">
                      <p className="text-muted-foreground">{formatTick(row.at)}</p>
                      <p className="mt-0.5 font-mono tabular-nums">
                        {row.value.toFixed(1)} {unit}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                fill={`url(#${gradientId})`}
                strokeWidth={1.75}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3, fill: color, stroke: "none" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Samples appear here while a server runs.
          </div>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
        {stats.map((s, i) => (
          <div key={s.label} className={i === 1 ? "text-center" : i === 2 ? "text-right" : undefined}>
            <dt className="text-muted-foreground">{s.label}</dt>
            <dd className="font-mono tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function summary(values: number[]) {
  if (!values.length) return { min: 0, avg: 0, max: 0 };
  return {
    min: Math.min(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    max: Math.max(...values),
  };
}

export function CpuLoadChart({ samples }: { samples: MetricSample[] }) {
  const points = useMemo(
    () => downsample(filterRange(samples, "1h")).map((s) => ({ at: s.t, value: s.hostCpu })),
    [samples],
  );
  const s = summary(points.map((p) => p.value));
  const latest = samples[samples.length - 1]?.hostCpu ?? 0;
  return (
    <LoadChart
      title="Host CPU"
      points={points}
      current={latest.toFixed(0)}
      unit="%"
      max={100}
      color="var(--color-chart-cpu)"
      stats={[
        { label: "Min", value: `${s.min.toFixed(0)}%` },
        { label: "Average", value: `${s.avg.toFixed(0)}%` },
        { label: "Peak", value: `${s.max.toFixed(0)}%` },
      ]}
    />
  );
}

export function RamLoadChart({ samples }: { samples: MetricSample[] }) {
  const latest = samples[samples.length - 1];
  const totalGb = latest?.hostRamGb ?? HOST_RAM_GB;
  const points = useMemo(
    () =>
      downsample(filterRange(samples, "1h")).map((s) => ({
        at: s.t,
        value: ramFromPct(s.hostRamPct, s.hostRamGb ?? totalGb),
      })),
    [samples, totalGb],
  );
  const s = summary(points.map((p) => p.value));
  return (
    <LoadChart
      title="Host memory"
      points={points}
      current={ramFromPct(latest?.hostRamPct ?? 0, totalGb).toFixed(1)}
      unit={`/ ${totalGb.toFixed(0)} GB`}
      max={totalGb}
      color="var(--color-chart-ram)"
      stats={[
        { label: "Min", value: `${s.min.toFixed(1)} GB` },
        { label: "Average", value: `${s.avg.toFixed(1)} GB` },
        { label: "Peak", value: `${s.max.toFixed(1)} GB` },
      ]}
    />
  );
}
