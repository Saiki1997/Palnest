import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SaveBar } from "@/components/save-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { connectionReport, defaultOps, type OpsState } from "@/lib/ops";
import { settingOn } from "@/lib/monitor";
import { useAppStore } from "@/lib/store";
import { cn, formatUptime } from "@/lib/utils";

export function ServerOpsPanel() {
  const server = useAppStore((s) => s.server);
  const ops = useAppStore((s) => s.ops);
  const crashWatchdog = useAppStore((s) => s.crashWatchdog);
  const setOps = useAppStore((s) => s.setOps);
  const setFlags = useAppStore((s) => s.setFlags);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const restartServer = useAppStore((s) => s.restartServer);
  const settings = useAppStore((s) => s.worldSettings);
  const log = useAppStore((s) => s.log);

  const merged = { ...defaultOps(), ...ops };
  const [draft, setDraft] = useState<Partial<OpsState> | null>(null);
  const [watchDraft, setWatchDraft] = useState<boolean | null>(null);
  const [time, setTime] = useState("21:15");
  const [report, setReport] = useState("");

  const next = { ...merged, ...draft };
  const times = next.scheduleRestartTimes?.length ? next.scheduleRestartTimes : next.scheduleRestart ? [next.scheduleRestart] : [];
  const watchdog = watchDraft ?? crashWatchdog;
  const dirty = Boolean(draft) || watchDraft !== null;

  function patch(p: Partial<OpsState>) {
    setDraft((d) => ({ ...(d ?? {}), ...p }));
  }

  function save() {
    if (draft) setOps(draft);
    if (watchDraft !== null) setFlags({ crashWatchdog: watchDraft });
    setDraft(null);
    setWatchDraft(null);
    toast.success("Saved ops");
  }

  function runCheck() {
    const text = connectionReport({
      name: server.name,
      running: server.running,
      pid: server.pid,
      port: server.port,
      queryPort: server.queryPort,
      restPort: server.restPort,
      rconPort: server.rconPort,
      listenAt: server.listenAt,
      publicIp: server.publicIp,
      tunnelHost: server.tunnel.game ? `${server.tunnel.game.host}:${server.tunnel.game.port}` : undefined,
      restOn: settingOn(settings, "RESTAPIEnabled"),
    });
    setReport(text);
    log({ level: "info", source: "app", message: "Connection check written. Copy it into a bug report if something will not join." });
    toast.success("Connection check ready");
  }

  const countdown = useMemo(() => {
    if (!next.scheduleRestartOn || !times.length) return "Off";
    return `Daily at ${times.join(", ")}`;
  }, [next.scheduleRestartOn, times]);

  return (
    <div className="grid gap-4">
      <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{server.running ? `${server.name} is running.` : "Server is stopped."}</p>
          <p className="text-sm text-muted-foreground">
            {server.running ? `Uptime ${formatUptime(server.listenAt ?? server.startedAt)} · UDP ${server.port}` : "Launch when you want players in."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {server.running ? (
            <>
              <Button variant="outline" onClick={() => stopServer(server.id)}>
                Stop
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const err = restartServer(server.id);
                  if (err) toast.error(err);
                  else toast.success("Restarting");
                }}
              >
                Restart now
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                const err = startServer(server.id);
                if (err) toast.error(err);
                else toast.success("Dedicated started");
              }}
            >
              Launch server
            </Button>
          )}
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-medium">Scheduled restarts</h2>
              <p className="mt-1 text-sm text-muted-foreground">{countdown}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{next.scheduleRestartOn ? "On" : "Off"}</Badge>
              <Switch checked={next.scheduleRestartOn} onCheckedChange={(v) => patch({ scheduleRestartOn: v })} />
            </div>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {(["times", "interval"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => patch({ scheduleRestartMode: mode })}
                className={cn(
                  "h-9 rounded-sm border px-3 text-sm",
                  next.scheduleRestartMode === mode ? "border-primary bg-background" : "border-border hover:bg-muted",
                )}
              >
                {mode === "times" ? "Daily at set times" : "On an interval"}
              </button>
            ))}
          </div>
          {next.scheduleRestartMode === "interval" ? (
            <label className="grid gap-2 text-sm">
              Hours between restarts
              <Input
                inputMode="numeric"
                value={String(next.scheduleRestartHours || 6)}
                onChange={(e) => patch({ scheduleRestartHours: Math.max(1, Number(e.target.value) || 6) })}
              />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-36" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const hhmm = time.length === 5 ? time : "";
                    if (!/^\d{2}:\d{2}$/.test(hhmm)) {
                      toast.error("Use HH:MM");
                      return;
                    }
                    if (times.includes(hhmm)) return;
                    const nextTimes = [...times, hhmm].sort();
                    patch({ scheduleRestartTimes: nextTimes, scheduleRestart: nextTimes[0] ?? "" });
                  }}
                >
                  Add time
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {times.map((t) => (
                  <span key={t} className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 font-mono text-sm">
                    {t}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const nextTimes = times.filter((x) => x !== t);
                        patch({ scheduleRestartTimes: nextTimes, scheduleRestart: nextTimes[0] ?? "" });
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {times.length ? <p className="mt-2 text-sm text-muted-foreground">Daily at {times.join(", ")}.</p> : null}
            </>
          )}
          <p className="mt-4 text-xs font-medium tracking-widest text-muted-foreground uppercase">Countdown warnings</p>
          <p className="mt-1 text-sm text-muted-foreground">Warns 3 times · 30s → 5s, then restarts.</p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => {
              const err = restartServer(server.id);
              if (err) toast.error(err);
              else toast.success("Restarting now");
            }}
          >
            Restart now
          </Button>
        </article>

        <article className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 className="font-medium">Crash watchdog</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{watchdog ? "Armed" : "Off"}</Badge>
              <Switch checked={watchdog} onCheckedChange={(v) => setWatchDraft(v)} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Only fires when the server exits without this app asking it to, so stopping, restarting and scheduled
            restarts are never mistaken for crashes. Capped at 3 recoveries an hour, because a crash loop means
            something is wrong. If Palworld updated recently, turn Server UE4SS off on Frameworks before blaming
            anything else.
          </p>
        </article>
      </div>

      <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-medium">Connection check</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Checks the process, game port, admin API, firewall and public address, then writes a report you can paste into a bug reply.
          </p>
        </div>
        <Button variant="outline" onClick={runCheck}>
          Check my connection
        </Button>
      </article>
      {report ? (
        <Textarea value={report} readOnly className="min-h-40 font-mono text-xs" />
      ) : null}

      <SaveBar dirty={dirty} onSave={save} onDiscard={() => { setDraft(null); setWatchDraft(null); }} hint="Ops stay in memory until you save." />
    </div>
  );
}
