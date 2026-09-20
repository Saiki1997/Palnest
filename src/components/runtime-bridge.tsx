import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { fleetOf, patchInstance } from "@/lib/fleet";
import { backupDue, crashLine, defaultOps, dueAnySchedule, dueIntervalRestart, formatJoinMotd, pruneBackups, webhookPayload } from "@/lib/ops";
import { backupIntervalLabel, resolveBackupMinutes } from "@/lib/backup";
import { hostAutostart, hostDetectAgents, hostKind, hostMetrics, hostNotify, postWebhook } from "@/lib/host";
import {
  bootListenLines,
  denListenMs,
  DEN_LISTEN_TIMEOUT_MS,
  isListenLine,
  portwarpAttachNote,
  queryPortUdpLikely,
  simulatedListenProbe,
} from "@/lib/listen";
import { overlayHost } from "@/lib/monitor";
import { blameCrash } from "@/lib/crash-blame";
import { composeEngineIni, mergeFx } from "@/lib/fx";
import { tweaksToIni } from "@/lib/args";
import {
  enableModOnDisk,
  mapUpnp,
  restAnnounce,
  restMetrics,
  restPlayers,
  spawnDenProcess,
  spawnTunnelAgent,
  stopDenProcess,
  stopTunnelAgent,
  writeDenToDisk,
  zipSavedFolder,
  probeDenListen,
} from "@/lib/runtime";
import { useAppStore } from "@/lib/store";
import { joinHost } from "@/lib/tunnels";

export function RuntimeBridge() {
  const hydrateReady = useAppStore((s) => s.hydrateReady);
  const instances = useAppStore((s) => s.instances);
  const server = useAppStore((s) => s.server);
  const paths = useAppStore((s) => s.paths);
  const launchArgs = useAppStore((s) => s.launchArgs);
  const engineTweaks = useAppStore((s) => s.engineTweaks);
  const worldSettings = useAppStore((s) => s.worldSettings);
  const worlds = useAppStore((s) => s.worlds);
  const mods = useAppStore((s) => s.mods);
  const bans = useAppStore((s) => s.bans);
  const allow = useAppStore((s) => s.allow);
  const ops = useAppStore((s) => s.ops);
  const crashWatchdog = useAppStore((s) => s.crashWatchdog);
  const captureConsole = useAppStore((s) => s.captureConsole);
  const startServer = useAppStore((s) => s.startServer);
  const stopServer = useAppStore((s) => s.stopServer);
  const patchServer = useAppStore((s) => s.patchServer);
  const pushConsole = useAppStore((s) => s.pushConsole);
  const log = useAppStore((s) => s.log);
  const runTunnel = useAppStore((s) => s.runTunnel);
  const installHit = useAppStore((s) => s.installHit);
  const restartServer = useAppStore((s) => s.restartServer);
  const lastBackupAt = useAppStore((s) => s.lastBackupAt);

  const prevRun = useRef(new Set<string>());
  const prevWritten = useRef<Record<string, string | null>>({});
  const prevMods = useRef<Record<string, boolean>>({});
  const prevTunnel = useRef<Record<string, boolean>>({});
  const lastAgentKind = useRef<Record<string, "playit" | "portwarp">>({});
  const prevPlayers = useRef<Record<string, string[]>>({});
  const autostartDone = useRef(false);
  const restarting = useRef(new Set<string>());
  const backupInit = useRef(false);
  const prevBackup = useRef<string | null>(null);
  const scheduleBusy = useRef(false);
  const recoveries = useRef<Record<string, number[]>>({});

  function denWritePayload(inst: typeof server) {
    const merged = mergeFx(useAppStore.getState().fx);
    return {
      engineIni: merged.engineIniServer || composeEngineIni({
        tweaksIni: tweaksToIni(engineTweaks, "server"),
        blocks: merged.engineBlocks,
        target: "server",
        uiScale: merged.uiScale,
      }),
      clientEngineIni: merged.engineIniClient || composeEngineIni({
        tweaksIni: tweaksToIni(engineTweaks, "client"),
        blocks: merged.engineBlocks,
        target: "client",
        uiScale: merged.uiScale,
      }),
      inst,
    };
  }

  useEffect(() => {
    const locale = ops?.locale ?? "en";
    document.documentElement.lang = locale === "ja" ? "ja" : locale === "zh" ? "zh-CN" : "en";
  }, [ops?.locale]);

  useEffect(() => {
    if (!hydrateReady) return;
    void hostAutostart(Boolean(ops?.autostart));
    const api = typeof window !== "undefined" ? window.palnestDesktop : undefined;
    void api?.setTray?.(ops?.tray !== false);
  }, [hydrateReady, ops?.autostart, ops?.tray]);

  useEffect(() => {
    if (!hydrateReady || autostartDone.current) return;
    autostartDone.current = true;
    const flags = { ...defaultOps(), ...ops };
    if (!flags.autostart) return;
    const fleet = fleetOf({ instances, server });
    for (const inst of fleet) {
      if (inst.autostart && !inst.running) startServer(inst.id);
      if (flags.startTunnels && inst.autostart && inst.tunnel.provider !== "none" && inst.tunnel.status !== "online") {
        runTunnel(inst.id, "start");
      }
    }
  }, [hydrateReady, instances, ops, runTunnel, server, startServer]);

  useEffect(() => {
    const api = typeof window !== "undefined" ? window.palnestDesktop : undefined;
    if (!api?.onConsole || !captureConsole) return;
    return api.onConsole((ev) => {
      if (ev?.id && ev.text) pushConsole(ev.id, ev.text.trimEnd(), ev.stream === "err" ? "err" : "out");
    });
  }, [captureConsole, pushConsole]);

  useEffect(() => {
    const api = typeof window !== "undefined" ? window.palnestDesktop : undefined;
    if (!api?.onDeepLink) return;
    return api.onDeepLink((url) => {
      const raw = String(url || "");
      const body = raw.replace(/^palnest:\/\//i, "");
      if (body.startsWith("join/")) {
        toast.message(`Join ${body.slice(5)}`);
        return;
      }
      const mod = body.match(/^mod\/(steam|nexus|curseforge)\/(.+)/i);
      if (mod) {
        const source = mod[1].toLowerCase() as "steam" | "nexus" | "curseforge";
        const id = mod[2];
        installHit(
          {
            id: `dl-${source}-${id}`,
            name: `${source} ${id}`,
            author: source,
            version: "latest",
            source,
            sourceId: id,
            url: source === "steam" ? `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}` : `palnest://${body}`,
            downloads: 0,
            description: "Opened from a palnest:// link.",
            kind: "ue4ss",
            updatedAt: new Date().toISOString(),
            serverCompatible: true,
            gameVersions: [],
            requires: [],
          },
          "server",
        );
        toast.success(`Queued ${source} ${id}`);
      }
    });
  }, [installHit]);

  useEffect(() => {
    if (!hydrateReady) return;
    const fleet = fleetOf({ instances, server });
    const live = new Set(fleet.filter((i) => i.running).map((i) => i.id));
    const prev = prevRun.current;
    for (const inst of fleet) {
      if (inst.running && !prev.has(inst.id)) {
        const world = worlds.find((w) => w.id === inst.worldId);
        void (async () => {
          await writeDenToDisk({
            inst,
            settings: worldSettings,
            world,
            paths,
            launchArgs,
            bans: bans ?? [],
            allow: allow ?? [],
            linux: ops?.linuxHost,
            engineTweaks,
            engineIni: denWritePayload(inst).engineIni,
            clientEngineIni: denWritePayload(inst).clientEngineIni,
          });
          const spawned = await spawnDenProcess(inst, launchArgs, paths, ops?.linuxHost);
          if (spawned.pid) patchServer(inst.id, { pid: spawned.pid });
          if (ops?.upnp) await mapUpnp(inst.port, true);
          const waitMs = denListenMs(inst.version);
          if (spawned.simulated) {
            pushConsole(inst.id, `[PALNEST] Simulated spawn of PalServer.exe on UDP ${inst.port} (pid ${spawned.pid ?? "—"})`);
          } else {
            pushConsole(inst.id, `[PALNEST] Spawned PalServer.exe pid ${spawned.pid ?? "—"} (console stays in Palnest)`);
          }
          pushConsole(
            inst.id,
            `[PALNEST] Waiting for PalServer to bind UDP ${inst.port} before starting PortWarp / playit (~${Math.round(waitMs / 1000)}s on ${inst.version}, longer on a real world load).`,
          );
        })();
      }
      if (!inst.running && prev.has(inst.id)) {
        void stopDenProcess(inst.id);
        patchServer(inst.id, { pid: null });
        if (ops?.upnp) void mapUpnp(inst.port, false);
        if (ops?.webhook) void postWebhook(ops.webhook, webhookPayload("stop", `${inst.name} stopped.`));
      }
    }
    prevRun.current = live;
  }, [allow, bans, engineTweaks, hydrateReady, instances, launchArgs, ops, patchServer, paths, pushConsole, server, worldSettings, worlds]);

  useEffect(() => {
    if (!hydrateReady) return;
    const fleet = fleetOf({ instances, server });
    for (const inst of fleet) {
      const stamp = inst.writtenAt;
      if (stamp && prevWritten.current[inst.id] !== stamp) {
        prevWritten.current[inst.id] = stamp;
        const world = worlds.find((w) => w.id === inst.worldId);
        void writeDenToDisk({
          inst,
          settings: worldSettings,
          world,
          paths,
          launchArgs,
          bans: bans ?? [],
          allow: allow ?? [],
          linux: ops?.linuxHost,
          engineTweaks,
          engineIni: denWritePayload(inst).engineIni,
          clientEngineIni: denWritePayload(inst).clientEngineIni,
        });
      }
    }
  }, [allow, bans, engineTweaks, hydrateReady, instances, launchArgs, ops?.linuxHost, paths, server, worldSettings, worlds]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const mod of mods) {
      next[mod.id] = mod.enabled;
      if (prevMods.current[mod.id] !== undefined && prevMods.current[mod.id] !== mod.enabled && mod.installPath) {
        void enableModOnDisk(mod.installPath, mod.kind, mod.enabled);
      }
    }
    prevMods.current = next;
  }, [mods]);

  useEffect(() => {
    if (!hydrateReady) return;
    const timers = new Map<string, number>();
    let cancelled = false;

    async function tickListen(id: string) {
      const s = useAppStore.getState();
      const inst = fleetOf(s).find((i) => i.id === id);
      if (!inst || !inst.running || inst.listenAt || cancelled) return;
      const lines = s.consoleLines?.[id] ?? [];
      let game = lines.some((l) => isListenLine(l.text));
      let queryUdp = false;
      if (hostKind() === "desktop") {
        const g = await probeDenListen(inst.port);
        const q = await probeDenListen(inst.queryPort);
        if (g.bound && g.transport === "udp") game = true;
        queryUdp = Boolean(q.bound && q.transport === "udp");
      } else if (simulatedListenProbe(inst).bound) {
        game = true;
        queryUdp = queryPortUdpLikely(inst.version);
      }
      const latest = fleetOf(useAppStore.getState()).find((i) => i.id === id);
      if (!latest || latest.listenAt || !latest.running || cancelled) return;
      const started = latest.startedAt ? Date.now() - new Date(latest.startedAt).getTime() : 0;
      if (!game && hostKind() === "desktop" && started > DEN_LISTEN_TIMEOUT_MS) {
        game = true;
        pushConsole(id, `[PALNEST] Timed out waiting for UDP ${latest.port}. Attaching the tunnel on the game port anyway.`);
      }
      if (!game) return;
      if (hostKind() !== "desktop") {
        const have = new Set((useAppStore.getState().consoleLines?.[id] ?? []).map((l) => l.text));
        for (const line of bootListenLines(latest)) {
          if (!have.has(line)) pushConsole(id, line);
        }
      }
      useAppStore.setState((st) => patchInstance(st, id, { listenAt: new Date().toISOString(), queryBound: queryUdp }));
      const after = fleetOf(useAppStore.getState()).find((i) => i.id === id);
      const tun = after?.tunnel;
      if (tun?.provider === "portwarp" && tun.status === "online") {
        pushConsole(id, portwarpAttachNote({ ...latest, queryBound: queryUdp }));
      } else if (tun?.provider === "playit" && tun.status === "online") {
        pushConsole(id, `[PALNEST] UDP ${latest.port} bound. Starting playit agent.`);
      }
      const hook = useAppStore.getState().ops?.webhook;
      if (hook && after) {
        void postWebhook(hook, webhookPayload("start", `${after.name} listening on ${joinHost(after)}`));
      }
    }

    const fleet = fleetOf({ instances, server });
    for (const inst of fleet) {
      if (!inst.running || inst.listenAt) continue;
      const handle = window.setInterval(() => {
        void tickListen(inst.id);
      }, 700);
      timers.set(inst.id, handle);
      void tickListen(inst.id);
    }
    return () => {
      cancelled = true;
      for (const handle of timers.values()) window.clearInterval(handle);
    };
  }, [hydrateReady, instances, pushConsole, server]);

  useEffect(() => {
    const fleet = fleetOf({ instances, server });
    const live = new Set(fleet.map((i) => i.id));
    for (const inst of fleet) {
      const kind = inst.tunnel.provider;
      const want =
        (kind === "playit" || kind === "portwarp") &&
        inst.tunnel.status === "online" &&
        inst.running &&
        Boolean(inst.listenAt);
      const on = Boolean(prevTunnel.current[inst.id]);
      if (want && !on) {
        prevTunnel.current[inst.id] = true;
        lastAgentKind.current[inst.id] = kind;
        void spawnTunnelAgent(kind, inst, paths).then((r) => {
          const label = kind === "portwarp" ? "PortWarp" : "playit";
          const detail =
            kind === "portwarp"
              ? `${inst.port}${inst.queryBound ? ` + query ${inst.queryPort}` : ""} (explicit map, no A2S auto-detect)`
              : String(inst.port);
          if (r.simulated) {
            pushConsole(inst.id, `[PALNEST] ${label} agent staged for UDP ${detail}.`);
          } else if (r.ok) {
            pushConsole(inst.id, `[PALNEST] ${label} pid ${r.pid ?? "—"}`);
          } else {
            pushConsole(inst.id, `[PALNEST] ${label} failed: ${r.error || "could not start the agent"}`, "err");
          }
        });
      } else if (!want && on) {
        prevTunnel.current[inst.id] = false;
        const stopKind = lastAgentKind.current[inst.id] ?? (kind === "playit" || kind === "portwarp" ? kind : undefined);
        if (stopKind) void stopTunnelAgent(stopKind);
      }
    }
    for (const id of Object.keys(prevTunnel.current)) {
      if (!live.has(id) && prevTunnel.current[id]) {
        prevTunnel.current[id] = false;
        const stopKind = lastAgentKind.current[id];
        if (stopKind) void stopTunnelAgent(stopKind);
      }
    }
  }, [instances, paths, pushConsole, server]);

  useEffect(() => {
    const fleet = fleetOf({ instances, server });
    for (const inst of fleet) {
      const ids = inst.players.filter((p) => p.online).map((p) => p.playerId);
      if (!Object.prototype.hasOwnProperty.call(prevPlayers.current, inst.id)) {
        prevPlayers.current[inst.id] = ids;
        continue;
      }
      const prev = prevPlayers.current[inst.id] ?? [];
      for (const id of ids) {
        if (!prev.includes(id)) {
          const p = inst.players.find((row) => row.playerId === id);
          const text = `${p?.name || id} joined ${inst.name}`;
          if (ops?.webhook) void postWebhook(ops.webhook, webhookPayload("join", text));
          void hostNotify(`${p?.name || id} joined`, inst.name);
          const motd = formatJoinMotd(inst.joinMotd || "", p?.name || "wanderer", inst.name);
          if (motd) {
            void restAnnounce(inst, worldSettings, motd);
            useAppStore.getState().announce(motd, inst.id);
            pushConsole(inst.id, `[MOTD] ${motd}`);
          }
        }
      }
      for (const id of prev) {
        if (!ids.includes(id) && ops?.webhook) {
          void postWebhook(ops.webhook, webhookPayload("leave", `${id} left ${inst.name}`));
        }
      }
      prevPlayers.current[inst.id] = ids;
    }
  }, [instances, ops?.webhook, pushConsole, server, worldSettings]);

  useEffect(() => {
    if (!hydrateReady) return;
    if (!backupInit.current) {
      backupInit.current = true;
      prevBackup.current = lastBackupAt ?? null;
      return;
    }
    if (!lastBackupAt || prevBackup.current === lastBackupAt) return;
    prevBackup.current = lastBackupAt;
    const s = useAppStore.getState();
    const fleet = fleetOf(s);
    const inst = fleet.find((i) => i.id === s.activeServerId) ?? s.server;
    void zipSavedFolder(inst, s.paths, s.ops?.backupPath).then((r) => {
      if (r.ok) {
        const zipPath = "path" in r ? r.path : undefined;
        pushConsole(inst.id, `[PALNEST] Saved-folder zip ${zipPath ?? "queued"}`);
        if (zipPath) {
          useAppStore.setState((st) => ({
            backups: st.backups.map((b, i) => (i === 0 ? { ...b, zipPath } : b)),
          }));
        }
        if (s.ops?.webhook) void postWebhook(s.ops.webhook, webhookPayload("backup", `Saved zip for ${inst.name}`));
      }
    });
  }, [hydrateReady, lastBackupAt, pushConsole]);

  useEffect(() => {
    if (!hydrateReady) return;
    const id = window.setInterval(() => {
      if (scheduleBusy.current) return;
      const s = useAppStore.getState();
      const flags = { ...defaultOps(), ...s.ops };
      const fleet = fleetOf(s);
      const running = fleet.filter((i) => i.running);

      const minutes = resolveBackupMinutes(flags);
      if (flags.scheduleBackupOn && minutes && backupDue(s.lastBackupAt ?? null, minutes) && running.length) {
        s.createBackup("auto", `Scheduled ${backupIntervalLabel(minutes)}`);
        useAppStore.setState((st) => ({
          lastBackupAt: new Date().toISOString(),
          backups: pruneBackups(st.backups, flags.backupKeep || 7),
        }));
      }

      const restartTimes =
        flags.scheduleRestartTimes?.length
          ? flags.scheduleRestartTimes
          : flags.scheduleRestart
            ? [flags.scheduleRestart]
            : [];
      const timesDue =
        flags.scheduleRestartOn &&
        flags.scheduleRestartMode !== "interval" &&
        dueAnySchedule(restartTimes, new Date(), s.lastRestartDay);
      const earliestStart = running.map((i) => i.startedAt).filter(Boolean).sort()[0] ?? s.server.startedAt;
      const intervalDue =
        flags.scheduleRestartOn &&
        flags.scheduleRestartMode === "interval" &&
        dueIntervalRestart(flags.scheduleRestartHours || 6, earliestStart);
      if ((timesDue || intervalDue) && running.length) {
        const stamp = new Date();
        const hhmm = `${String(stamp.getHours()).padStart(2, "0")}:${String(stamp.getMinutes()).padStart(2, "0")}`;
        scheduleBusy.current = true;
        useAppStore.setState({ lastRestartDay: `${stamp.toISOString().slice(0, 10)}|${hhmm}` });
        const label = restartTimes[0] || flags.scheduleRestart || "interval";
        log({
          level: "warn",
          source: "schedule",
          message: `Scheduled restart ${label} — warning, then cycling worlds.`,
        });
        const ids = running.map((i) => i.id);
        const warn = (sec: number) => {
          const live = fleetOf(useAppStore.getState()).filter((i) => ids.includes(i.id));
          for (const inst of live) {
            void restAnnounce(inst, useAppStore.getState().worldSettings, `Scheduled restart in ${sec} seconds.`);
            pushConsole(inst.id, `[PALNEST] Scheduled restart in ${sec}s`);
          }
        };
        warn(30);
        window.setTimeout(() => warn(15), 15000);
        window.setTimeout(() => warn(5), 25000);
        window.setTimeout(() => {
          for (const id of ids) restartServer(id);
          scheduleBusy.current = false;
        }, 30000);
      }
    }, 20000);
    return () => window.clearInterval(id);
  }, [hydrateReady, log, pushConsole, restartServer]);

  useEffect(() => {
    if (!hydrateReady) return;
    const desktop = hostKind() === "desktop";
    const id = window.setInterval(() => {
      const s = useAppStore.getState();
      const fleet = fleetOf(s);
      for (const inst of fleet) {
        if (!inst.running || restarting.current.has(inst.id)) continue;
        void (async () => {
          if (desktop) {
            const m = await hostMetrics(inst.id);
            if (crashWatchdog && !m.running) {
              const now = Date.now();
              const rec = (recoveries.current[inst.id] ?? []).filter((t) => now - t < 60 * 60 * 1000);
              if (rec.length >= 3) {
                log({
                  level: "error",
                  source: "watchdog",
                  message: `${inst.name} crashed 3 times in an hour. Watchdog stopped restarting it.`,
                });
                stopServer(inst.id);
                return;
              }
              recoveries.current[inst.id] = [...rec, now];
              restarting.current.add(inst.id);
              pushConsole(inst.id, crashLine(), "err");
              const snap = useAppStore.getState();
              const blame = blameCrash(snap.mods, snap.consoleLines?.[inst.id] ?? []);
              if (blame) {
                const culprit = snap.mods.find((mod) => mod.id === blame.modId);
                if (culprit?.enabled) useAppStore.getState().toggleMod(blame.modId);
                log({
                  level: "error",
                  source: "watchdog",
                  message: `${inst.name} crashed. Likely cause: ${blame.name}. Disabled it and restarting. ${blame.evidence}`,
                });
                pushConsole(inst.id, `[PALNEST] Crash blamed on ${blame.name}. Pack disabled for the next boot.`, "err");
              } else {
                log({ level: "error", source: "watchdog", message: `${inst.name} crashed. Watchdog is restarting it.` });
              }
              const hook = useAppStore.getState().ops?.webhook;
              if (hook) void postWebhook(hook, webhookPayload("crash", `${inst.name} crashed${blame ? ` (blamed ${blame.name})` : ""} and is restarting.`));
              stopServer(inst.id);
              window.setTimeout(() => {
                startServer(inst.id);
                restarting.current.delete(inst.id);
              }, 1800);
              return;
            }
            const rest = await restMetrics(inst, s.worldSettings);
            const live = await restPlayers(inst, s.worldSettings);
            if (live.ok && !live.simulated && live.players.length) {
              patchServer(inst.id, { players: live.players });
            }
            useAppStore.setState((st) => {
              const samples = [...(st.monitor?.samples ?? [])];
              const last = samples[samples.length - 1];
              if (!last?.running) return st;
              samples[samples.length - 1] = overlayHost(last, m, rest.metrics ?? undefined);
              return { monitor: { ...st.monitor, samples } };
            });
          }
        })();
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [crashWatchdog, hydrateReady, log, patchServer, pushConsole, startServer, stopServer]);

  useEffect(() => {
    if (!hydrateReady) return;
    void hostDetectAgents().then((scan) => {
      if (scan.simulated) return;
      const fleet = fleetOf(useAppStore.getState());
      for (const inst of fleet) {
        const kind = inst.tunnel.provider;
        if (kind !== "playit" && kind !== "portwarp") continue;
        const hit = kind === "playit" ? scan.playit : scan.portwarp;
        if (hit.installed && !inst.tunnel.agentInstalled) {
          useAppStore.getState().patchServer(inst.id, {
            tunnel: { ...inst.tunnel, agentInstalled: true, agentVersion: hit.path || "detected" },
          });
        }
        if (hit.running) {
          pushConsole(inst.id, `[PALNEST] ${hit.name} already running${hit.path ? ` (${hit.path})` : ""}.`);
        }
      }
    });
  }, [hydrateReady, pushConsole]);

  return null;
}
