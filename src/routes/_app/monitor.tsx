import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { FleetStrip } from "@/components/fleet-bar";
import { AlertList, DiskForecastCard, HealthStrip, useMonitorView, WorldPulseStrip } from "@/components/world-pulse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store";
import type { HistoryRange } from "@/lib/monitor";
import { runChecker } from "@/lib/checker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/monitor")({ component: MonitorPage });

const ResourceChart = lazy(() => import("@/components/resource-chart"));

function MonitorPage() {
  const mode = useAppStore((s) => s.mode);
  const frameworks = useAppStore((s) => s.frameworks);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const setThresholds = useAppStore((s) => s.setMonitorThresholds);
  const view = useMonitorView();
  const [range, setRange] = useState<HistoryRange>("1h");
  const findings = runChecker({
    mods: view.mods,
    mode,
    gameVersion: view.server.version,
    frameworks,
  });
  const issues = findings.filter((f) => f.severity !== "info").length;

  if (mode === "client") return <Navigate to="/" />;

  const t = view.thresholds;
  const latest = view.latest;

  return (
    <div>
      <PageHeader
        title="Monitor"
        description="Host vs PalServer resources, REST sim FPS from /v1/api/metrics, and WORLD PULSE. Operational health stays separate from save evidence."
        actions={
          view.server.running ? (
            <Button
              variant="outline"
              onClick={() => {
                stopServer();
                toast.message("Dedicated stopped");
              }}
            >
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => {
                const err = startServer();
                if (err) toast.error(err);
                else toast.success("Dedicated started");
              }}
            >
              Start
            </Button>
          )
        }
      />

      <div className="mb-6">
        <FleetStrip compact />
        <WorldPulseStrip pulse={view.pulse} showLink={false} />
      </div>

      <div className="mb-6">
        <HealthStrip
          running={view.server.running}
          restOn={view.restOn}
          rconOn={view.rconOn}
          mods={view.mods.filter((m) => m.enabled).length}
          issues={issues}
          backups={view.backups.length}
        />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Gauge
          label="PalServer CPU"
          value={latest?.running ? `${latest.procCpu.toFixed(0)}%` : "—"}
          pct={latest?.running ? latest.procCpu : 0}
          hint={latest?.running ? `${latest.threads} threads` : "Process not attached"}
          warn={latest ? latest.procCpu >= t.cpu : false}
        />
        <Gauge
          label="PalServer RAM"
          value={latest?.running ? `${latest.procRamGb.toFixed(1)} GB` : "—"}
          pct={latest?.running ? Math.min(100, (latest.procRamGb / 16) * 100) : 0}
          hint="Process working set"
          warn={latest ? latest.hostRamPct >= t.memory : false}
        />
        <Gauge
          label="Host CPU"
          value={`${(latest?.hostCpu ?? 0).toFixed(0)}%`}
          pct={latest?.hostCpu ?? 0}
          hint="Whole box, including the world"
        />
        <Gauge
          label="Host RAM"
          value={`${(latest?.hostRamPct ?? 0).toFixed(0)}%`}
          pct={latest?.hostRamPct ?? 0}
          hint="32 GB assumed for the sample world"
          warn={latest ? latest.hostRamPct >= t.memory : false}
        />
        <Gauge
          label="Sim FPS"
          value={latest?.fps != null ? latest.fps.toFixed(1) : view.restOn ? "—" : "REST off"}
          pct={latest?.fps != null ? (latest.fps / 30) * 100 : 0}
          hint={
            latest?.frameMs != null
              ? `${latest.frameMs.toFixed(1)} ms · /v1/api/metrics`
              : "Enable REST API in world files to read Palworld metrics"
          }
          warn={latest?.fps != null && latest.fps < t.fps}
        />
        <Gauge
          label="Disk"
          value={`${(latest?.diskUsedPct ?? 0).toFixed(0)}%`}
          pct={latest?.diskUsedPct ?? 0}
          hint={`${(latest?.diskFreeGb ?? 0).toFixed(0)} GB free · world ${view.world?.sizeMb ?? 0} MB`}
          warn={latest ? latest.diskUsedPct >= t.disk : false}
        />
      </div>

      <div className="mb-6">
        <Suspense fallback={<div className="h-64 rounded-xl border border-border bg-card" />}>
          <ResourceChart
            samples={view.samples}
            range={range}
            onRange={setRange}
            live={view.server.running}
            showFps={view.restOn}
          />
        </Suspense>
      </div>

      <div className="mb-6">
        <DiskForecastCard forecast={view.forecast} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Alert center</h2>
            <Badge variant={view.alerts.length ? "warn" : "ok"}>
              {view.alerts.length ? `${view.alerts.length} active` : "Quiet"}
            </Badge>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Sustained CPU, memory, disk, and sim FPS. A spike that recovers inside {t.sustainSec}s is not an alert.
          </p>
          <AlertList alerts={view.alerts} />
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 font-medium">Threshold rules</h2>
          <p className="mb-4 text-sm text-muted-foreground">Used for sustained alerts. Does not change PalServer.</p>
          <div className="grid gap-3">
            <ThresholdField label="Sustained CPU %" value={t.cpu} onChange={(n) => setThresholds({ cpu: n })} />
            <ThresholdField label="Host RAM %" value={t.memory} onChange={(n) => setThresholds({ memory: n })} />
            <ThresholdField label="Disk used %" value={t.disk} onChange={(n) => setThresholds({ disk: n })} />
            <ThresholdField label="Min sim FPS" value={t.fps} onChange={(n) => setThresholds({ fps: n })} />
            <ThresholdField
              label="Sustain seconds"
              value={t.sustainSec}
              onChange={(n) => setThresholds({ sustainSec: n })}
            />
          </div>
          {!view.restOn ? (
            <p className="mt-4 text-sm text-muted-foreground">
              REST API is off.{" "}
              <Link to="/worlds" search={{ tab: "ini" }} className="text-primary">
                Enable RESTAPIEnabled
              </Link>{" "}
              to read /v1/api/metrics.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Gauge({
  label,
  value,
  pct,
  hint,
  warn,
}: {
  label: string;
  value: string;
  pct: number;
  hint: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={cn("mt-2 text-lg font-medium tabular-nums tracking-tight", warn && "text-warn")}>{value}</p>
      <Progress value={pct} className={cn("mt-3", warn && "[&>div]:bg-warn")} />
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ThresholdField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
