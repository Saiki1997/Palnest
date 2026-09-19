import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  buildPulse,
  diskForecast,
  evaluateAlerts,
  type DiskForecast,
  type ResourceAlert,
  type WorldPulse,
} from "@/lib/monitor";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function useMonitorView() {
  const server = useAppStore((s) => s.server);
  const worlds = useAppStore((s) => s.worlds);
  const backups = useAppStore((s) => s.backups);
  const worldSaves = useAppStore((s) => s.worldSaves);
  const worldSettings = useAppStore((s) => s.worldSettings);
  const monitor = useAppStore((s) => s.monitor);
  const mods = useAppStore((s) => s.mods);

  const world = worlds.find((w) => w.active);
  const restOn = worldSettings.find((s) => s.key === "RESTAPIEnabled")?.value === "True";
  const rconOn = worldSettings.find((s) => s.key === "RCONEnabled")?.value === "True";
  const samples = monitor.samples;
  const latest = samples[samples.length - 1];
  const save = world ? worldSaves[world.id] : undefined;
  const alerts = useMemo(
    () => evaluateAlerts(samples, monitor.thresholds),
    [samples, monitor.thresholds],
  );
  const pulse = useMemo(
    () =>
      buildPulse({
        running: server.running,
        startedAt: server.startedAt,
        players: server.players.filter((p) => p.online).length,
        world,
        save,
        backups,
        session: monitor.session,
        alerts,
        restOn,
      }),
    [server, world, save, backups, monitor.session, alerts, restOn],
  );
  const forecast = useMemo(() => diskForecast(samples), [samples]);
  const online = server.players.filter((p) => p.online);
  const known = save?.players.length ?? server.players.length;

  return {
    server,
    world,
    backups,
    samples,
    latest,
    alerts,
    pulse,
    forecast,
    restOn,
    rconOn,
    mods,
    online,
    known,
    guilds: save?.guilds.length ?? world?.guilds ?? 0,
    bases: save?.guilds.reduce((n, g) => n + g.bases, 0) ?? 0,
    thresholds: monitor.thresholds,
  };
}

export function WorldPulseStrip({
  pulse,
  compact,
  showLink = true,
}: {
  pulse: WorldPulse;
  compact?: boolean;
  showLink?: boolean;
}) {
  const health =
    pulse.health === "running" ? "ok" : pulse.health === "degraded" ? "warn" : "outline";
  const cells = [
    { label: "Day", value: String(pulse.day), hint: "From save ticks, not uptime" },
    { label: "World clock", value: pulse.clock, hint: pulse.worldName },
    { label: "Session", value: pulse.uptime, hint: pulse.health === "stopped" ? "Dedicated down" : "PalServer" },
    { label: "Players", value: `${pulse.players} · peak ${pulse.peakPlayers}`, hint: `${pulse.joins} joins · ${pulse.leaves} leaves` },
    { label: "Save", value: pulse.saveLabel, hint: "Authoritative last write" },
    { label: "Backup", value: pulse.backupLabel, hint: pulse.lastTransition ?? "No recent join/leave" },
  ];

  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", compact && "p-4")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">World pulse</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved-world evidence plus the live PalServer session. Clock is not guessed from process uptime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={health}>{pulse.health}</Badge>
          {pulse.restOn ? <Badge variant="outline">REST metrics</Badge> : <Badge variant="outline">REST off</Badge>}
          {showLink ? (
            <Link to="/monitor" className="text-sm text-primary">
              Open monitor
            </Link>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{c.label}</p>
            <p className="mt-1 font-medium tabular-nums tracking-tight">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HealthStrip({
  running,
  restOn,
  rconOn,
  mods,
  issues,
  backups,
}: {
  running: boolean;
  restOn: boolean;
  rconOn: boolean;
  mods: number;
  issues: number;
  backups: number;
}) {
  const items = [
    { k: "Dedicated", v: running ? "Running" : "Stopped" },
    { k: "REST", v: restOn ? "On" : "Off" },
    { k: "RCON", v: rconOn ? "On" : "Off" },
    { k: "Mods", v: issues ? `${mods} · ${issues} to check` : `${mods} live` },
    { k: "Backup", v: backups ? `${backups} available` : "None" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
      <span className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Health</span>
      {items.map((i) => (
        <span key={i.k} className="text-muted-foreground">
          {i.k} <span className="font-medium text-foreground">{i.v}</span>
        </span>
      ))}
      <Link to="/checker" className="text-sm text-primary sm:ml-auto">
        Scan
      </Link>
    </div>
  );
}

export function DiskForecastCard({ forecast }: { forecast: DiskForecast }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">Disk space prediction</p>
      <p className="mt-2 text-lg font-medium tabular-nums tracking-tight">{forecast.freeGb.toFixed(1)} GB free</p>
      <p className="mt-1 text-sm text-muted-foreground">{forecast.note}</p>
      <p className="mt-2 text-xs text-muted-foreground">{forecast.usedPct.toFixed(0)}% of the volume in use.</p>
    </section>
  );
}

export function AlertList({ alerts }: { alerts: ResourceAlert[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No sustained threshold breaches on this window.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {alerts.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div>
            <p className="text-sm font-medium">{a.title}</p>
            <p className="text-sm text-muted-foreground">{a.detail}</p>
          </div>
          <Badge variant={a.severity === "error" ? "danger" : "warn"}>{a.kind}</Badge>
        </li>
      ))}
    </ul>
  );
}
