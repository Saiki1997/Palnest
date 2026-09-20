import { useMemo } from "react";
import { buildPulse, diskForecast, evaluateAlerts } from "@/lib/monitor";
import { useAppStore } from "@/lib/store";

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
