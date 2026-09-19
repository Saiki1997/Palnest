import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppMode,
  InstallTarget,
  InstalledMod,
  KeysState,
  LogEntry,
  PathsState,
  SaveGuild,
  SavePlayer,
  SearchHit,
  SavKind,
  ServerState,
  TunnelProvider,
  WorldSaveData,
  WorldSnapshot,
} from "./types";
import type { WorldMeta } from "./sav";
import { emptyState, freshConfigured, sampleState, SERVER_VERSIONS, type PalnestState } from "./seed";
import { CATALOG, CURRENT_GAME } from "./catalog";
import { modInstallPath } from "./paths";
import { applyParsed, mergeSettings, parseOptionSettings } from "./ini";
import { addCustomArg, mergeEngineTweaks, OPTIMIZE_PRESETS } from "./args";
import { nid } from "./utils";
import { scanListing, type ScanFile, type ScanResult } from "./scan";
import { bootConflicts } from "./checker";
import {
  appendSample,
  DEFAULT_THRESHOLDS,
  emptyMonitor,
  sampleAt,
  seedHistory,
  settingOn,
  type MonitorThresholds,
} from "./monitor";
import { fleetOf, migrateFleet, nextSlot, normalizeInstance, patchInstance, portConflicts, portsForSlot, suggestedInstallPath, worldBusy } from "./fleet";
import { advanceTunnel, type TunnelAction } from "./tunnels";
import {
  applyProfile,
  bootConsole,
  defaultOps,
  pruneBackups,
  snapshotProfile,
  tickConsoleLine,
  type BanEntry,
  type ModProfile,
  type OpsState,
} from "./ops";

type LogInput = Omit<LogEntry, "id" | "ts"> & { id?: string; ts?: string };

interface Actions {
  hydrateReady: boolean;
  completeSetup: (
    mode: AppMode,
    paths: PathsState,
    imported?: { name?: string; ini?: string },
    listings?: { client?: ScanFile[]; server?: ScanFile[] },
  ) => void;
  loadSample: () => void;
  setMode: (mode: AppMode) => void;
  setPaths: (paths: Partial<PathsState>) => void;
  setKeys: (keys: Partial<KeysState>) => void;
  setFlags: (flags: Partial<Pick<PalnestState, "autoBackup" | "crashWatchdog" | "captureConsole" | "checkModUpdates">>) => void;
  dismissGuide: () => void;
  markCheckerRan: () => void;
  log: (entry: LogInput) => void;
  clearLogs: () => void;
  installHit: (hit: SearchHit, target: InstallTarget) => void;
  toggleMod: (id: string) => void;
  uninstallMod: (id: string) => void;
  updateMod: (id: string) => void;
  updateAllMods: () => number;
  moveMod: (id: string, dir: -1 | 1) => void;
  setModTarget: (id: string, target: InstallTarget) => void;
  installFramework: (
    id: "ue4ss" | "palschema" | "reshade" | "optiscaler",
    side: InstallTarget,
    version: string,
    assetName: string,
  ) => void;
  startServer: (id?: string) => string | null;
  stopServer: (id?: string) => void;
  restartServer: (id?: string) => string | null;
  updateServer: (version: string, id?: string) => void;
  rollbackServer: (id?: string) => void;
  selectServer: (id: string) => void;
  createServer: (input: {
    name: string;
    description?: string;
    installPath?: string;
    worldMode: "new" | "clone" | "existing";
    worldId?: string;
    maxPlayers?: number;
    community?: boolean;
    notes?: string;
  }) => { id: string; error?: string };
  removeServer: (id: string) => string | null;
  patchServer: (id: string, patch: Partial<ServerState>) => string | null;
  startAllServers: () => { started: number; skipped: number };
  stopAllServers: () => number;
  setTunnelProvider: (id: string, provider: TunnelProvider) => void;
  runTunnel: (id: string, action: TunnelAction, provider?: TunnelProvider) => string | null;
  importServer: (input: {
    path: string;
    name: string;
    ini?: string;
    detectMods?: boolean;
    listing?: ScanFile[];
    asNew?: boolean;
  }) => { added: number; updated: number; id: string };
  ingestDetected: (target: InstallTarget, result: ScanResult) => { added: number; updated: number };
  switchWorld: (id: string) => void;
  createBackup: (kind: PalnestState["backups"][number]["kind"], label: string) => void;
  restoreBackup: (id: string) => void;
  setLaunchArg: (id: string, patch: Partial<PalnestState["launchArgs"][number]>) => void;
  addLaunchArg: (flag: string, value?: string) => void;
  removeLaunchArg: (id: string) => void;
  applyPreset: (id: string) => void;
  setWorldSetting: (key: string, value: string) => void;
  resetWorldSettings: () => void;
  importIni: (raw: string) => number;
  patchWorld: (id: string, patch: Partial<PalnestState["worlds"][number]>) => void;
  ensureWorldSave: (worldId: string) => void;
  setOptionOverride: (worldId: string, value: boolean) => void;
  upsertSavePlayer: (worldId: string, player: SavePlayer) => void;
  removeSavePlayer: (worldId: string, playerId: string) => void;
  upsertSaveGuild: (worldId: string, guild: SaveGuild) => void;
  removeSaveGuild: (worldId: string, guildId: string) => void;
  applySavImport: (worldId: string, input: {
    fileName: string;
    size: number;
    settings?: Record<string, string>;
    snapshot?: WorldSnapshot;
    kind: SavKind;
    note?: string;
    meta?: WorldMeta;
  }) => number;
  setEngineTweak: (id: string, patch: Partial<PalnestState["engineTweaks"][number]>) => void;
  applyFix: (action: string, modId?: string) => void;
  tickMonitor: () => void;
  setMonitorThresholds: (patch: Partial<MonitorThresholds>) => void;
  resetAll: () => void;
  setOps: (patch: Partial<OpsState>) => void;
  pushConsole: (id: string, text: string, stream?: "out" | "err") => void;
  clearConsole: (id?: string) => void;
  saveProfile: (name: string, notes?: string) => void;
  applyProfileById: (id: string) => string | null;
  removeProfile: (id: string) => void;
  addBan: (entry: Omit<BanEntry, "id" | "at"> & { id?: string; at?: string }) => void;
  removeBan: (id: string) => void;
  setAllow: (ids: string[]) => void;
  kick: (playerId: string, serverId?: string) => void;
  announce: (message: string, serverId?: string) => void;
  saveWorldLive: (serverId?: string) => void;
  writeDenFiles: (serverId?: string) => void;
  snapshotSaved: (serverId?: string) => void;
  importBanlist: (text: string) => number;
  assignPlayerToGuild: (worldId: string, playerId: string, guildName: string) => void;
  banPlayer: (playerId: string, serverId?: string, reason?: string) => void;
}

export type Store = PalnestState & Actions;

const MAX_LOGS = 200;

function pushLog(logs: LogEntry[], entry: LogInput): LogEntry[] {
  const next: LogEntry = {
    id: entry.id ?? nid("log"),
    ts: entry.ts ?? new Date().toISOString(),
    level: entry.level,
    source: entry.source,
    message: entry.message,
  };
  return [next, ...logs].slice(0, MAX_LOGS);
}

function mergeDetected(s: PalnestState, target: InstallTarget, result: ScanResult) {
  let added = 0;
  let updated = 0;
  let mods = [...s.mods];
  const order0 = mods.reduce((n, m) => Math.max(n, m.loadOrder), 0);
  for (const [i, hit] of result.mods.entries()) {
    const existing = mods.find(
      (m) => (hit.catalogId && m.catalogId === hit.catalogId) || (m.name === hit.name && m.kind === hit.kind),
    );
    if (existing) {
      const nextTarget: InstallTarget = existing.target === target || existing.target === "both" ? existing.target : "both";
      mods = mods.map((m) =>
        m.id === existing.id
          ? {
              ...m,
              target: nextTarget,
              enabled: hit.enabled,
              broken: hit.broken,
              installPath: hit.installPath || m.installPath,
              fileCount: hit.fileCount || m.fileCount,
              sizeKb: hit.sizeKb || m.sizeKb,
              notes: hit.notes ?? m.notes,
            }
          : m,
      );
      updated += 1;
      continue;
    }
    const catalog = hit.catalogId ? CATALOG.find((c) => c.id === hit.catalogId) : undefined;
    mods.push({
      id: nid("mod"),
      catalogId: hit.catalogId,
      name: hit.name,
      author: catalog?.author ?? "On disk",
      version: hit.version ?? catalog?.version ?? "detected",
      latestVersion: catalog?.version ?? hit.version ?? "detected",
      kind: hit.kind,
      source: catalog?.source ?? "local",
      sourceId: catalog?.sourceId ?? hit.slug,
      target,
      enabled: hit.enabled,
      loadOrder: order0 + (i + 1) * 10,
      gameVersions: catalog?.gameVersions ?? [],
      requires: catalog?.requires ?? [],
      serverCompatible: catalog?.serverCompatible ?? true,
      clientCompatible: catalog?.clientCompatible ?? true,
      description: catalog?.description ?? `Detected in ${result.root}`,
      category: catalog?.category ?? "Detected",
      installPath: hit.installPath,
      fileCount: hit.fileCount,
      sizeKb: hit.sizeKb,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      broken: hit.broken,
      notes: hit.notes ?? (hit.broken ? "Missing Scripts/main.lua or pack files." : undefined),
    });
    added += 1;
  }

  const stamp = new Date().toISOString();
  const frameworks = { ...s.frameworks };
  if (result.frameworks.ue4ss) {
    const fw = frameworks.ue4ss;
    frameworks.ue4ss = {
      ...fw,
      clientVersion: target === "server" ? fw.clientVersion : result.frameworks.ue4ss,
      serverVersion: target === "client" ? fw.serverVersion : result.frameworks.ue4ss,
      latestKnown: fw.latestKnown ?? result.frameworks.ue4ss,
      assetName: fw.assetName ?? "UE4SS-Palworld.zip",
      updatedAt: stamp,
    };
  }
  if (result.frameworks.palschema) {
    const fw = frameworks.palschema;
    frameworks.palschema = {
      ...fw,
      clientVersion: target === "server" ? fw.clientVersion : result.frameworks.palschema,
      serverVersion: target === "client" ? fw.serverVersion : result.frameworks.palschema,
      latestKnown: fw.latestKnown ?? result.frameworks.palschema,
      assetName: fw.assetName ?? "PalSchema.zip",
      updatedAt: stamp,
    };
  }
  if (result.frameworks.reshade) {
    const fw = frameworks.reshade;
    frameworks.reshade = {
      ...fw,
      clientVersion: target === "server" ? fw.clientVersion : fw.clientVersion ?? "detected",
      serverVersion: target === "client" ? fw.serverVersion : fw.serverVersion ?? "detected",
      updatedAt: stamp,
    };
  }
  return { mods, frameworks, added, updated };
}

function ensureSave(saves: Record<string, WorldSaveData>, worldId: string): WorldSaveData {
  return (
    saves[worldId] ?? {
      worldId,
      optionOverride: false,
      worldTime: "Day 0 · 08:00",
      players: [],
      guilds: [],
    }
  );
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyState(),
      hydrateReady: false,
      completeSetup: (mode, paths, imported, listings) => {
        let next = freshConfigured(mode, paths, imported);
        if (imported?.ini) {
          const parsed = parseOptionSettings(imported.ini);
          next.worldSettings = applyParsed(next.worldSettings, parsed);
          if (parsed.ServerName) next.server.name = parsed.ServerName.replace(/^"|"$/g, "");
          if (parsed.ServerDescription) next.server.description = parsed.ServerDescription.replace(/^"|"$/g, "");
          if (parsed.PublicPort) next.server.port = Number(parsed.PublicPort) || next.server.port;
          if (parsed.ServerPlayerMaxNum) next.server.maxPlayers = Number(parsed.ServerPlayerMaxNum) || 32;
          next.instances = [next.server];
          next.activeServerId = next.server.id;
        }
        let added = 0;
        let updated = 0;
        if (listings?.client?.length && paths.client.trim()) {
          const merged = mergeDetected(next, "client", scanListing(paths.client.trim(), listings.client));
          next = { ...next, mods: merged.mods, frameworks: merged.frameworks };
          added += merged.added;
          updated += merged.updated;
        }
        if (listings?.server?.length && paths.server.trim()) {
          const merged = mergeDetected(next, "server", scanListing(paths.server.trim(), listings.server));
          next = { ...next, mods: merged.mods, frameworks: merged.frameworks };
          added += merged.added;
          updated += merged.updated;
        }
        if (added || updated) {
          next = {
            ...next,
            logs: pushLog(next.logs, {
              level: "ok",
              source: "scan",
              message: `Detected mods already on disk: ${added} new, ${updated} already listed.`,
            }),
          };
        }
        set({ ...next, hydrateReady: true });
      },
      loadSample: () => set({ ...sampleState(), hydrateReady: true }),
      setMode: (mode) =>
        set((s) => ({
          mode,
          logs: pushLog(s.logs, {
            level: "info",
            source: "palnest",
            message:
              mode === "client"
                ? "Switched to client-only. Server pages are tucked away."
                : mode === "server"
                  ? "Switched to server-only. Game install is optional."
                  : "Managing both the game client and dedicated server.",
          }),
        })),
      setPaths: (paths) => set((s) => ({ paths: { ...s.paths, ...paths } })),
      ingestDetected: (target, result) => {
        let added = 0;
        let updated = 0;
        set((s) => {
          const merged = mergeDetected(s, target, result);
          added = merged.added;
          updated = merged.updated;
          return {
            mods: merged.mods,
            frameworks: merged.frameworks,
            logs: pushLog(s.logs, {
              level: merged.added || merged.updated ? "ok" : "info",
              source: "scan",
              message: `Scanned ${result.root || "install"} (${target}): ${merged.added} new, ${merged.updated} already listed.`,
            }),
          };
        });
        return { added, updated };
      },
      setKeys: (keys) => set((s) => ({ keys: { ...s.keys, ...keys } })),
      setFlags: (flags) => set(flags),
      dismissGuide: () => set({ guideDismissed: true }),
      markCheckerRan: () => set({ checkerRan: true }),
      log: (entry) => set((s) => ({ logs: pushLog(s.logs, entry) })),
      clearLogs: () => set({ logs: [] }),
      installHit: (hit, target) => {
        const catalog = CATALOG.find((c) => c.id === hit.id);
        const kind = catalog?.kind === "framework" ? "palschema" : hit.kind;
        const s = get();
        if (s.mods.some((m) => m.name === hit.name && m.source === hit.source)) {
          set((st) => ({
            logs: pushLog(st.logs, {
              level: "warn",
              source: "mods",
              message: `${hit.name} is already in the world.`,
            }),
          }));
          return;
        }
        const order = s.mods.reduce((n, m) => Math.max(n, m.loadOrder), 0) + 10;
        const mod: InstalledMod = {
          id: nid("mod"),
          catalogId: catalog?.id,
          name: hit.name,
          author: hit.author,
          version: hit.version,
          latestVersion: hit.version,
          kind,
          source: hit.source,
          sourceId: hit.sourceId,
          target,
          enabled: true,
          loadOrder: order,
          gameVersions: hit.gameVersions.length ? hit.gameVersions : [s.server.version],
          requires: hit.requires,
          serverCompatible: hit.serverCompatible,
          clientCompatible: catalog?.clientCompatible ?? true,
          description: hit.description,
          category: catalog?.category ?? "Installed",
          installPath: modInstallPath(kind, hit.name, target, s.paths),
          fileCount: 3,
          sizeKb: catalog?.sizeKb ?? 128,
          installedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((st) => ({
          mods: [...st.mods, mod],
          logs: pushLog(st.logs, {
            level: "ok",
            source: hit.source,
            message: `Installed ${hit.name} ${hit.version} → ${target}.`,
          }),
        }));
      },
      toggleMod: (id) =>
        set((s) => {
          const mods = s.mods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
          const mod = mods.find((m) => m.id === id);
          return {
            mods,
            logs: pushLog(s.logs, {
              level: "info",
              source: "mods",
              message: `${mod?.name ?? "Mod"} ${mod?.enabled ? "enabled" : "disabled"}.`,
            }),
          };
        }),
      uninstallMod: (id) =>
        set((s) => {
          const mod = s.mods.find((m) => m.id === id);
          return {
            mods: s.mods.filter((m) => m.id !== id),
            logs: pushLog(s.logs, {
              level: "info",
              source: "mods",
              message: `Removed ${mod?.name ?? "mod"} and restored the install folder.`,
            }),
          };
        }),
      updateMod: (id) =>
        set((s) => ({
          mods: s.mods.map((m) =>
            m.id === id
              ? { ...m, version: m.latestVersion, updatedAt: new Date().toISOString(), broken: false, fileCount: Math.max(1, m.fileCount) }
              : m,
          ),
          logs: pushLog(s.logs, {
            level: "ok",
            source: "mods",
            message: `Updated ${s.mods.find((m) => m.id === id)?.name ?? "mod"} to ${s.mods.find((m) => m.id === id)?.latestVersion}.`,
          }),
        })),
      updateAllMods: () => {
        const stale = get().mods.filter((m) => m.version !== m.latestVersion);
        if (!stale.length) return 0;
        set((s) => ({
          mods: s.mods.map((m) =>
            m.version === m.latestVersion ? m : { ...m, version: m.latestVersion, updatedAt: new Date().toISOString() },
          ),
          logs: pushLog(s.logs, {
            level: "ok",
            source: "mods",
            message: `Updated ${stale.length} mod${stale.length === 1 ? "" : "s"} to their listed latest.`,
          }),
        }));
        return stale.length;
      },
      moveMod: (id, dir) =>
        set((s) => {
          const sorted = [...s.mods].sort((a, b) => a.loadOrder - b.loadOrder);
          const i = sorted.findIndex((m) => m.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= sorted.length) return s;
          const a = sorted[i].loadOrder;
          sorted[i] = { ...sorted[i], loadOrder: sorted[j].loadOrder };
          sorted[j] = { ...sorted[j], loadOrder: a };
          return { mods: sorted };
        }),
      setModTarget: (id, target) =>
        set((s) => ({
          mods: s.mods.map((m) =>
            m.id === id ? { ...m, target, installPath: modInstallPath(m.kind, m.name, target, s.paths) } : m,
          ),
        })),
      installFramework: (id, side, version, assetName) =>
        set((s) => {
          const fw = s.frameworks[id];
          if (!fw) return s;
          const clientVersion =
            side === "client" || side === "both" ? version : fw.clientVersion;
          const serverVersion =
            side === "server" || side === "both" ? version : fw.serverVersion;
          return {
            frameworks: {
              ...s.frameworks,
              [id]: {
                ...fw,
                clientVersion,
                serverVersion,
                latestKnown: version,
                assetName,
                updatedAt: new Date().toISOString(),
              },
            },
            logs: pushLog(s.logs, {
              level: "ok",
              source: id,
              message: `Installed ${fw.name} ${version} (${assetName}) on ${side}.`,
            }),
          };
        }),
      startServer: (id) => {
        const s = get();
        const fleet = fleetOf(s);
        const targetId = id ?? s.activeServerId ?? fleet[0]?.id;
        const inst = fleet.find((i) => i.id === targetId);
        if (!inst) return "No dedicated server in this world.";
        if (inst.running) return null;
        const blockers = bootConflicts(s.mods, { frameworks: s.frameworks, mode: s.mode });
        if (blockers.length) {
          const message = `Mod conflict blocks start: ${blockers[0].title}. Open Checker and disable the overlap.`;
          set((st) => ({
            logs: pushLog(st.logs, { level: "error", source: "checker", message }),
          }));
          return message;
        }
        const clash = portConflicts(fleet, inst, true);
        if (clash) {
          const message = `UDP ${clash.port} (${clash.label}) is already used by ${clash.otherName}.`;
          set((st) => ({
            logs: pushLog(st.logs, { level: "error", source: "fleet", message }),
          }));
          return message;
        }
        if (inst.worldId) {
          const busy = worldBusy(fleet, inst.worldId, inst.id);
          if (busy) {
            const message = `${busy.name} is already running the same world. Stop it before starting ${inst.name}.`;
            set((st) => ({
              logs: pushLog(st.logs, { level: "error", source: "fleet", message }),
            }));
            return message;
          }
        }
        const already = fleet.filter((i) => i.running).length;
        set((st) => {
          const world = st.worlds.find((w) => w.id === inst.worldId) ?? st.worlds.find((w) => w.active);
          const restOn = settingOn(st.worldSettings, "RESTAPIEnabled");
          const startedAt = new Date().toISOString();
          const players = inst.players.filter((p) => p.online).length;
          const sample = sampleAt(Date.now(), {
            running: true,
            players: already ? already + 1 : players,
            worldMb: world?.sizeMb ?? 200,
            restOn,
            restart: true,
          });
          const next = patchInstance(st, inst.id, {
            running: true,
            startedAt,
            writtenAt: startedAt,
            listenAt: null,
            queryBound: false,
          });
          const tunnelNote =
            inst.tunnel.status === "online" && inst.tunnel.game
              ? ` Tunnel ${inst.tunnel.game.ip}:${inst.tunnel.game.port}.`
              : "";
          const boot = bootConsole({ name: inst.name, version: inst.version, port: inst.port, build: inst.build }).map((text) => ({
            id: nid("con"),
            ts: startedAt,
            stream: "out" as const,
            text,
          }));
          return {
            ...next,
            denSettings: { ...(st.denSettings ?? {}), [inst.id]: st.worldSettings },
            consoleLines: { ...(st.consoleLines ?? {}), [inst.id]: [...(st.consoleLines?.[inst.id] ?? []), ...boot].slice(-120) },
            monitor: {
              ...st.monitor,
              samples: appendSample(st.monitor.samples, sample),
              session: {
                ...st.monitor.session,
                peakPlayers: Math.max(st.monitor.session.peakPlayers, players),
                lastTransition: `${inst.name} started`,
              },
            },
            logs: pushLog(st.logs, {
              level: already ? "warn" : "ok",
              source: "server",
              message: `${inst.name} ${inst.version} started on UDP ${inst.port}.${tunnelNote}${
                already ? ` ${already + 1} worlds running on this host.` : ""
              }`,
            }),
          };
        });
        return null;
      },
      stopServer: (id) =>
        set((s) => {
          const fleet = fleetOf(s);
          const targetId = id ?? s.activeServerId ?? fleet[0]?.id;
          const inst = fleet.find((i) => i.id === targetId);
          if (!inst) return s;
          const world = s.worlds.find((w) => w.id === inst.worldId) ?? s.worlds.find((w) => w.active);
          const restOn = settingOn(s.worldSettings, "RESTAPIEnabled");
          const remaining = fleet.filter((i) => i.running && i.id !== inst.id).length;
          const sample = sampleAt(Date.now(), {
            running: remaining > 0,
            players: remaining,
            worldMb: world?.sizeMb ?? 0,
            restOn,
          });
          const next = patchInstance(s, inst.id, { running: false, startedAt: null, players: [], pid: null, listenAt: null, queryBound: false });
          return {
            ...next,
            monitor: {
              ...s.monitor,
              samples: appendSample(s.monitor.samples, sample),
            },
            logs: pushLog(s.logs, {
              level: "info",
              source: "server",
              message: `${inst.name} stopped. World saved.`,
            }),
          };
        }),
      restartServer: (id) => {
        get().stopServer(id);
        return get().startServer(id);
      },
      updateServer: (version, id) =>
        set((s) => {
          const fleet = fleetOf(s);
          const targetId = id ?? s.activeServerId ?? fleet[0]?.id;
          const inst = fleet.find((i) => i.id === targetId);
          if (!inst) return s;
          const prev = inst.version;
          const meta = inst.versions.find((v) => v.version === version);
          const bound = s.worlds.find((w) => w.id === inst.worldId) ?? s.worlds.find((w) => w.active);
          const backup = bound
            ? {
                id: nid("bak"),
                worldId: bound.id,
                worldName: bound.name,
                createdAt: new Date().toISOString(),
                sizeMb: bound.sizeMb,
                kind: "pre-update" as const,
                label: `Before ${version} (${inst.name})`,
                version: prev,
              }
            : null;
          const next = patchInstance(s, inst.id, {
            version,
            running: false,
            startedAt: null,
            players: [],
            history: [...inst.history, version],
            build: version.replaceAll(".", "") + "10",
          });
          return {
            ...next,
            backups: backup ? [backup, ...s.backups] : s.backups,
            logs: pushLog(
              pushLog(s.logs, {
                level: "ok",
                source: "steamcmd",
                message: `Updated ${inst.name} ${prev} → ${version}. ${meta?.notes ?? ""}`.trim(),
              }),
              {
                level: "warn",
                source: "checker",
                message: "Run the mod checker. Overlapping packs can crash PalServer even when they omit a Palworld version.",
              },
            ),
          };
        }),
      rollbackServer: (id) =>
        set((s) => {
          const fleet = fleetOf(s);
          const targetId = id ?? s.activeServerId ?? fleet[0]?.id;
          const inst = fleet.find((i) => i.id === targetId);
          if (!inst) return s;
          const hist = [...inst.history];
          if (hist.length < 2) return s;
          hist.pop();
          const version = hist[hist.length - 1];
          const bound = s.worlds.find((w) => w.id === inst.worldId) ?? s.worlds.find((w) => w.active);
          const backup = bound
            ? {
                id: nid("bak"),
                worldId: bound.id,
                worldName: bound.name,
                createdAt: new Date().toISOString(),
                sizeMb: bound.sizeMb,
                kind: "pre-rollback" as const,
                label: `Before rollback to ${version} (${inst.name})`,
                version: inst.version,
              }
            : null;
          const next = patchInstance(s, inst.id, {
            version,
            running: false,
            startedAt: null,
            players: [],
            history: hist,
          });
          return {
            ...next,
            backups: backup ? [backup, ...s.backups] : s.backups,
            logs: pushLog(s.logs, {
              level: "ok",
              source: "steamcmd",
              message: `Rolled ${inst.name} back to ${version}. Mods were left in place.`,
            }),
          };
        }),
      selectServer: (id) =>
        set((s) => {
          const fleet = migrateFleet(s);
          const inst = fleet.instances.find((i) => i.id === id);
          if (!inst) return s;
          const prevId = s.activeServerId || s.server.id;
          const denSettings = { ...(s.denSettings ?? {}) };
          if (prevId && prevId !== id) denSettings[prevId] = s.worldSettings;
          const worldSettings = denSettings[id] ?? s.worldSettings;
          const worlds = inst.worldId
            ? s.worlds.map((w) => ({ ...w, active: w.id === inst.worldId }))
            : s.worlds;
          return {
            ...fleet,
            server: inst,
            activeServerId: inst.id,
            worlds,
            denSettings,
            worldSettings,
            logs: pushLog(s.logs, {
              level: "info",
              source: "fleet",
              message: `Selected ${inst.name} (UDP ${inst.port}).`,
            }),
          };
        }),
      createServer: (input) => {
        const created = { id: nid("srv"), error: undefined as string | undefined };
        set((s) => {
          const name = input.name.trim() || "New world";
          const fleet = migrateFleet(s);
          if (fleet.instances.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
            created.error = "A world with that name already exists.";
            return s;
          }
          const slot = nextSlot(fleet.instances);
          const ports = portsForSlot(slot);
          const clash = portConflicts(fleet.instances, { id: "new", ...ports }, false);
          if (clash) {
            created.error = `Port ${clash.port} collides with ${clash.otherName}.`;
            return s;
          }
          let worlds = s.worlds;
          let worldSaves = s.worldSaves;
          let worldId = input.worldId || "";
          if (input.worldMode === "existing" && worldId) {
            if (!worlds.some((w) => w.id === worldId)) {
              created.error = "That world is not in this world.";
              return s;
            }
          } else {
            const source = worlds.find((w) => w.active) ?? worlds[0];
            const clone = input.worldMode === "clone" && source;
            worldId = nid("world");
            worlds = [
              ...worlds.map((w) => ({ ...w, active: false })),
              {
                id: worldId,
                name: clone ? `${source!.name} copy` : `${name} World`,
                guid: nid("guid").toUpperCase(),
                active: true,
                days: clone ? source!.days : 0,
                lastPlayed: new Date().toISOString(),
                sizeMb: clone ? Math.max(12, Math.round(source!.sizeMb * 0.15)) : 12,
                guilds: clone ? source!.guilds : 0,
                optionOverride: clone ? source!.optionOverride : false,
              },
            ];
            const prevSave = clone && source ? s.worldSaves[source.id] : undefined;
            worldSaves = {
              ...s.worldSaves,
              [worldId]: {
                worldId,
                optionOverride: prevSave?.optionOverride ?? false,
                worldTime: prevSave?.worldTime ?? "Day 0 · 08:00",
                players: prevSave?.players ?? [],
                guilds: prevSave?.guilds ?? [],
              },
            };
          }
          const inst = normalizeInstance({
            id: created.id,
            name,
            description: input.description?.trim() || "A second island.",
            running: false,
            startedAt: null,
            version: s.server.version || CURRENT_GAME,
            build: s.server.build,
            ...ports,
            maxPlayers: input.maxPlayers || 32,
            community: Boolean(input.community),
            publicIp: "",
            players: [],
            versions: SERVER_VERSIONS,
            history: [s.server.version || CURRENT_GAME],
            imported: false,
            importedFrom: "",
            installPath:
              s.ops?.layout === "shared"
                ? s.paths.server || s.server.installPath || input.installPath?.trim() || ""
                : input.installPath?.trim() || suggestedInstallPath(s.paths.server || s.server.installPath, name),
            worldId,
            slot,
            notes: input.notes?.trim() || "",
            layout: s.ops?.layout === "shared" ? "shared" : "copy",
          });
          created.id = inst.id;
          const instances = [...fleet.instances, inst];
          const denSettings = { ...(s.denSettings ?? {}), [s.activeServerId]: s.worldSettings, [inst.id]: s.worldSettings };
          return {
            instances,
            activeServerId: inst.id,
            server: inst,
            worlds,
            worldSaves,
            denSettings,
            logs: pushLog(s.logs, {
              level: "ok",
              source: "fleet",
              message: `Created ${inst.name} on UDP ${inst.port} / query ${inst.queryPort} / REST ${inst.restPort}.`,
            }),
          };
        });
        return created;
      },
      removeServer: (id) => {
        const s = get();
        const fleet = fleetOf(s);
        if (fleet.length < 2) return "Keep at least one world. Reset the app to start over.";
        const inst = fleet.find((i) => i.id === id);
        if (!inst) return "That world is already gone.";
        if (inst.running) return `Stop ${inst.name} before removing it.`;
        set((st) => {
          const instances = fleetOf(st).filter((i) => i.id !== id);
          const active = instances.find((i) => i.id === st.activeServerId) ?? instances[0];
          return {
            instances,
            activeServerId: active.id,
            server: active,
            logs: pushLog(st.logs, {
              level: "info",
              source: "fleet",
              message: `Removed ${inst.name}.`,
            }),
          };
        });
        return null;
      },
      patchServer: (id, patch) => {
        const s = get();
        const fleet = fleetOf(s);
        const inst = fleet.find((i) => i.id === id);
        if (!inst) return "World not found.";
        const nextPorts = {
          port: patch.port ?? inst.port,
          queryPort: patch.queryPort ?? inst.queryPort,
          restPort: patch.restPort ?? inst.restPort,
          rconPort: patch.rconPort ?? inst.rconPort,
        };
        const clash = portConflicts(fleet, { id, ...nextPorts }, false);
        if (clash && (patch.port || patch.queryPort || patch.restPort || patch.rconPort)) {
          return `Port ${clash.port} collides with ${clash.otherName}.`;
        }
        set((st) => {
          const next = patchInstance(st, id, patch);
          return {
            ...next,
            logs: pushLog(st.logs, {
              level: "info",
              source: "fleet",
              message: `Updated ${next.instances.find((i) => i.id === id)?.name ?? "world"} settings.`,
            }),
          };
        });
        return null;
      },
      startAllServers: () => {
        let started = 0;
        let skipped = 0;
        const ids = fleetOf(get())
          .filter((i) => !i.running)
          .map((i) => i.id);
        for (const id of ids) {
          const err = get().startServer(id);
          if (err) skipped += 1;
          else started += 1;
        }
        return { started, skipped };
      },
      stopAllServers: () => {
        const ids = fleetOf(get())
          .filter((i) => i.running)
          .map((i) => i.id);
        for (const id of ids) get().stopServer(id);
        return ids.length;
      },
      setTunnelProvider: (id, provider) =>
        set((s) => {
          const inst = fleetOf(s).find((i) => i.id === id);
          if (!inst) return s;
          const next = patchInstance(s, id, (cur) => ({
            ...cur,
            tunnel: advanceTunnel(cur.tunnel, "reset", {
              name: cur.name,
              slot: cur.slot,
              port: cur.port,
              queryPort: cur.queryPort,
              provider,
            }),
          }));
          const labeled = provider === "none" ? "direct / port-forward" : provider === "playit" ? "playit.gg" : "PortWarp";
          return {
            ...next,
            logs: pushLog(s.logs, {
              level: "info",
              source: "tunnel",
              message: `${inst.name} tunnel provider set to ${labeled}.`,
            }),
          };
        }),
      runTunnel: (id, action, provider) => {
        const s = get();
        const inst = fleetOf(s).find((i) => i.id === id);
        if (!inst) return "World not found.";
        const chosen = provider ?? inst.tunnel.provider;
        if (action !== "reset" && chosen === "none") return "Pick playit.gg or PortWarp first.";
        let error: string | null = null;
        set((st) => {
          const cur = fleetOf(st).find((i) => i.id === id);
          if (!cur) return st;
          const tunnel = advanceTunnel(cur.tunnel, action, {
            name: cur.name,
            slot: cur.slot,
            port: cur.port,
            queryPort: cur.queryPort,
            provider: chosen,
          });
          if (tunnel.status === "error" && tunnel.lastError) error = tunnel.lastError;
          const publicIp = tunnel.status === "online" && tunnel.game ? tunnel.game.ip : cur.publicIp;
          const next = patchInstance(st, id, { tunnel, publicIp, community: tunnel.status === "online" ? true : cur.community });
          const verb =
            action === "install"
              ? `Installed the ${chosen === "playit" ? "playit.gg" : "PortWarp"} agent on ${cur.name}.`
              : action === "claim"
                ? `Claim the playit agent: ${tunnel.claimUrl}`
                : action === "confirm"
                  ? `playit agent claimed for ${cur.name}.`
                  : action === "create"
                    ? `Created ${chosen === "playit" ? "Palworld" : "UDP"} tunnel for ${cur.name}${tunnel.game ? ` → ${tunnel.game.ip}:${tunnel.game.port}` : ""}.`
                    : action === "start"
                      ? tunnel.game
                        ? `${cur.name} tunnel online · ${tunnel.game.ip}:${tunnel.game.port}`
                        : `${cur.name} tunnel failed to start.`
                      : action === "stop"
                        ? `${cur.name} tunnel stopped.`
                        : `${cur.name} tunnel cleared.`;
          return {
            ...next,
            logs: pushLog(st.logs, {
              level: error ? "error" : action === "start" ? "ok" : "info",
              source: chosen === "none" ? "tunnel" : chosen,
              message: error ?? verb,
            }),
          };
        });
        return error;
      },
      importServer: ({ path, name, ini, detectMods, listing, asNew }) => {
        let added = 0;
        let updated = 0;
        let id = "";
        set((s) => {
          const fleet = migrateFleet(s);
          let worldSettings = s.worldSettings;
          const parsed = ini ? parseOptionSettings(ini) : {};
          const parsedName = parsed.ServerName ? parsed.ServerName.replace(/^"|"$/g, "") : "";
          const parsedDesc = parsed.ServerDescription ? parsed.ServerDescription.replace(/^"|"$/g, "") : "";
          const parsedPort = parsed.PublicPort ? Number(parsed.PublicPort) : NaN;
          const parsedMax = parsed.ServerPlayerMaxNum ? Number(parsed.ServerPlayerMaxNum) : NaN;
          if (ini) worldSettings = applyParsed(worldSettings, parsed);

          const makeFrom = (base: ServerState, slot: number): ServerState =>
            normalizeInstance({
              ...base,
              id: asNew ? nid("srv") : base.id,
              name: name || parsedName || base.name,
              description: parsedDesc || base.description,
              port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : asNew ? portsForSlot(slot).port : base.port,
              queryPort: asNew ? portsForSlot(slot).queryPort : base.queryPort,
              restPort: asNew ? portsForSlot(slot).restPort : base.restPort,
              rconPort: asNew ? portsForSlot(slot).rconPort : base.rconPort,
              maxPlayers: Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : base.maxPlayers,
              imported: true,
              importedFrom: path,
              installPath: path,
              slot,
              running: false,
              startedAt: null,
            });

          let instances = fleet.instances;
          let server: ServerState;
          if (asNew || (fleet.instances.length === 1 && !fleet.instances[0].imported && !fleet.instances[0].installPath && !s.paths.server)) {
            const slot = asNew ? nextSlot(fleet.instances) : fleet.instances[0]?.slot ?? 0;
            const inst = makeFrom(fleet.server, slot);
            id = inst.id;
            if (asNew) instances = [...fleet.instances, inst];
            else instances = fleet.instances.map((i) => (i.id === inst.id ? inst : i));
            server = inst;
          } else if (asNew) {
            const slot = nextSlot(fleet.instances);
            const inst = makeFrom(fleet.server, slot);
            id = inst.id;
            instances = [...fleet.instances, inst];
            server = inst;
          } else {
            const inst = makeFrom(fleet.server, fleet.server.slot);
            id = inst.id;
            instances = fleet.instances.map((i) => (i.id === inst.id ? inst : i));
            server = inst;
          }

          let mods = s.mods;
          let frameworks = s.frameworks;
          if (detectMods && listing?.length) {
            const merged = mergeDetected(
              { ...s, paths: { ...s.paths, server: path } },
              "server",
              scanListing(path, listing),
            );
            mods = merged.mods;
            frameworks = merged.frameworks;
            added = merged.added;
            updated = merged.updated;
          }
          const worlds = s.worlds.length
            ? s.worlds
            : [
                {
                  id: nid("world"),
                  name: server.name,
                  guid: nid("guid"),
                  active: true,
                  days: 1,
                  lastPlayed: new Date().toISOString(),
                  sizeMb: 48,
                  guilds: 0,
                },
              ];
          if (!server.worldId && worlds[0]) server = { ...server, worldId: worlds[0].id };
          instances = instances.map((i) => (i.id === server.id ? server : i));
          return {
            paths: { ...s.paths, server: asNew ? s.paths.server : path },
            instances,
            activeServerId: server.id,
            server,
            worldSettings,
            frameworks,
            worlds,
            mods,
            logs: pushLog(s.logs, {
              level: "ok",
              source: "import",
              message: `Imported ${server.name} at ${path}${added || updated ? ` · ${added} new, ${updated} already listed` : detectMods ? " · browse the folder to scan mods already on disk" : ""}.`,
            }),
          };
        });
        return { added, updated, id };
      },
      switchWorld: (id) =>
        set((s) => {
          const world = s.worlds.find((w) => w.id === id);
          const busy = worldBusy(fleetOf(s), id, s.activeServerId);
          const next = patchInstance(s, s.activeServerId || s.server.id, (inst) => ({
            ...inst,
            worldId: id,
            running: false,
            startedAt: null,
            players: [],
          }));
          return {
            ...next,
            worlds: s.worlds.map((w) => ({ ...w, active: w.id === id })),
            logs: pushLog(s.logs, {
              level: busy ? "warn" : "info",
              source: "worlds",
              message: busy
                ? `Active world is now ${world?.name ?? id}, but ${busy.name} is still running it.`
                : `Active world is now ${world?.name ?? id}. Start the server to load it.`,
            }),
          };
        }),
      createBackup: (kind, label) =>
        set((s) => {
          const active = s.worlds.find((w) => w.active) ?? s.worlds[0];
          if (!active) return s;
          const backup = {
            id: nid("bak"),
            worldId: active.id,
            worldName: active.name,
            createdAt: new Date().toISOString(),
            sizeMb: active.sizeMb,
            kind,
            label,
            version: s.server.version,
          };
          return {
            backups: [backup, ...s.backups],
            logs: pushLog(s.logs, {
              level: "ok",
              source: "backup",
              message: `Snapshot ${label} (${active.sizeMb} MB).`,
            }),
          };
        }),
      restoreBackup: (id) =>
        set((s) => {
          const b = s.backups.find((x) => x.id === id);
          if (!b) return s;
          const next = patchInstance(s, s.activeServerId || s.server.id, {
            running: false,
            startedAt: null,
            players: [],
            version: b.version,
          });
          return {
            ...next,
            logs: pushLog(s.logs, {
              level: "ok",
              source: "backup",
              message: `Restored ${b.worldName} from ${b.label}. Server stopped.`,
            }),
          };
        }),
      setLaunchArg: (id, patch) =>
        set((s) => ({
          launchArgs: s.launchArgs.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      addLaunchArg: (flag, value) =>
        set((s) => ({ launchArgs: [...s.launchArgs, addCustomArg(flag, value)] })),
      removeLaunchArg: (id) =>
        set((s) => ({ launchArgs: s.launchArgs.filter((a) => a.id !== id) })),
      applyPreset: (id) =>
        set((s) => {
          const preset = OPTIMIZE_PRESETS.find((p) => p.id === id);
          if (!preset) return s;
          const launchArgs = s.launchArgs.map((a) => {
            if (!(a.id in preset.args)) return a;
            const v = preset.args[a.id];
            if (typeof v === "boolean") return { ...a, enabled: v };
            if (typeof v === "string") return { ...a, value: v, enabled: true };
            return a;
          });
          const worldSettings = s.worldSettings.map((st) =>
            preset.settings[st.key] ? { ...st, value: preset.settings[st.key] } : st,
          );
          const engineTweaks = s.engineTweaks.map((t) => {
            if (!(t.id in preset.tweaks)) return t;
            const v = preset.tweaks[t.id];
            if (typeof v === "boolean") return { ...t, enabled: v };
            if (typeof v === "string") return { ...t, value: v, enabled: true };
            return t;
          });
          const nextPlayers = preset.settings.ServerPlayerMaxNum
            ? Number(preset.settings.ServerPlayerMaxNum) || preset.players
            : s.server.maxPlayers;
          const next = patchInstance(s, s.activeServerId || s.server.id, {
            maxPlayers: nextPlayers,
            community: preset.args.publiclobby === undefined ? s.server.community : Boolean(preset.args.publiclobby),
          });
          return {
            ...next,
            launchArgs,
            worldSettings,
            engineTweaks,
            logs: pushLog(s.logs, {
              level: "ok",
              source: "optimize",
              message: preset.stackable
                ? `Stacked the ${preset.name} preset on top of current args and Engine.ini.`
                : `Applied the ${preset.name} preset.`,
            }),
          };
        }),
      setWorldSetting: (key, value) =>
        set((s) => {
          const worldSettings = s.worldSettings.map((st) => (st.key === key ? { ...st, value } : st));
          const name = worldSettings.find((st) => st.key === "ServerName")?.value;
          const desc = worldSettings.find((st) => st.key === "ServerDescription")?.value;
          const port = Number(worldSettings.find((st) => st.key === "PublicPort")?.value);
          const max = Number(worldSettings.find((st) => st.key === "ServerPlayerMaxNum")?.value);
          const next = patchInstance(s, s.activeServerId || s.server.id, {
            name: name || s.server.name,
            description: desc ?? s.server.description,
            port: Number.isFinite(port) && port > 0 ? port : s.server.port,
            maxPlayers: Number.isFinite(max) && max > 0 ? max : s.server.maxPlayers,
          });
          return {
            ...next,
            worldSettings,
          };
        }),
      importIni: (raw) => {
        const parsed = parseOptionSettings(raw);
        const keys = Object.keys(parsed);
        set((s) => ({
          worldSettings: applyParsed(s.worldSettings, parsed),
          logs: pushLog(s.logs, {
            level: "ok",
            source: "ini",
            message: `Imported ${keys.length} PalWorldSettings keys.`,
          }),
        }));
        return keys.length;
      },
      resetWorldSettings: () =>
        set((s) => ({
          worldSettings: mergeSettings([]),
          logs: pushLog(s.logs, { level: "info", source: "ini", message: "World settings restored to vanilla defaults." }),
        })),
      patchWorld: (id, patch) =>
        set((s) => ({
          worlds: s.worlds.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),
      ensureWorldSave: (worldId) =>
        set((s) => {
          if (s.worldSaves[worldId]) return s;
          const world = s.worlds.find((w) => w.id === worldId);
          const players: SavePlayer[] = s.server.players.map((p) => ({
            id: p.playerId || nid("p"),
            name: p.name,
            uid: p.playerId,
            steamId: p.playerId,
            level: p.level,
            exp: 0,
            guild: p.guild === "—" ? "" : p.guild,
            pals: 0,
            lastSeen: new Date().toISOString(),
            online: p.online,
          }));
          const guildNames = [...new Set(players.map((p) => p.guild).filter(Boolean))];
          const guilds: SaveGuild[] = guildNames.map((name) => ({
            id: nid("g"),
            name,
            owner: players.find((p) => p.guild === name)?.name ?? "",
            members: players.filter((p) => p.guild === name).length,
            bases: 1,
          }));
          return {
            worldSaves: {
              ...s.worldSaves,
              [worldId]: {
                worldId,
                optionOverride: world?.optionOverride ?? false,
                worldTime: `Day ${world?.days ?? 0}`,
                players,
                guilds,
              },
            },
          };
        }),
      setOptionOverride: (worldId, value) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          return {
            worldSaves: { ...s.worldSaves, [worldId]: { ...prev, optionOverride: value } },
            worlds: s.worlds.map((w) => (w.id === worldId ? { ...w, optionOverride: value } : w)),
            logs: pushLog(s.logs, {
              level: value ? "warn" : "ok",
              source: "worlds",
              message: value
                ? "WorldOption.sav will be written. It overrides PalWorldSettings.ini for this world."
                : "WorldOption.sav marked absent. Dedicated will read PalWorldSettings.ini on the next boot.",
            }),
          };
        }),
      upsertSavePlayer: (worldId, player) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const exists = prev.players.some((p) => p.id === player.id);
          const players = exists ? prev.players.map((p) => (p.id === player.id ? player : p)) : [...prev.players, player];
          return { worldSaves: { ...s.worldSaves, [worldId]: { ...prev, players } } };
        }),
      removeSavePlayer: (worldId, playerId) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const player = prev.players.find((p) => p.id === playerId);
          const players = prev.players.filter((p) => p.id !== playerId);
          const guilds = prev.guilds.map((g) =>
            player && g.name === player.guild ? { ...g, members: Math.max(0, g.members - 1) } : g,
          );
          return {
            worldSaves: { ...s.worldSaves, [worldId]: { ...prev, players, guilds } },
            logs: pushLog(s.logs, {
              level: "warn",
              source: "worlds",
              message: `Removed ${player?.name ?? "player"} from the world snapshot.`,
            }),
          };
        }),
      upsertSaveGuild: (worldId, guild) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const exists = prev.guilds.some((g) => g.id === guild.id);
          const guilds = exists ? prev.guilds.map((g) => (g.id === guild.id ? guild : g)) : [...prev.guilds, guild];
          return {
            worldSaves: { ...s.worldSaves, [worldId]: { ...prev, guilds } },
            worlds: s.worlds.map((w) => (w.id === worldId ? { ...w, guilds: guilds.length } : w)),
          };
        }),
      removeSaveGuild: (worldId, guildId) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const guilds = prev.guilds.filter((g) => g.id !== guildId);
          return {
            worldSaves: { ...s.worldSaves, [worldId]: { ...prev, guilds } },
            worlds: s.worlds.map((w) => (w.id === worldId ? { ...w, guilds: guilds.length } : w)),
          };
        }),
      applySavImport: (worldId, input) => {
        const settingKeys = Object.keys(input.settings ?? {});
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const snap = input.snapshot;
          const optionOverride =
            input.kind === "worldoption" ? true : snap?.optionOverride ?? prev.optionOverride;
          const nextSave: WorldSaveData = {
            ...prev,
            optionOverride,
            worldTime: snap ? `Day ${snap.world.days}` : prev.worldTime,
            players: snap?.players ?? prev.players,
            guilds: snap?.guilds ?? prev.guilds,
            imported: {
              name: input.fileName,
              kind: input.kind,
              size: input.size,
              at: new Date().toISOString(),
              note: input.note,
            },
          };
          const worldPatch: Partial<PalnestState["worlds"][number]> = snap
            ? {
                name: snap.world.name || s.worlds.find((w) => w.id === worldId)?.name || "World",
                days: snap.world.days,
                sizeMb: snap.world.sizeMb,
                guilds: nextSave.guilds.length,
                optionOverride,
              }
            : { optionOverride, guilds: nextSave.guilds.length };
          if (input.meta?.worldName) worldPatch.name = input.meta.worldName;
          if (input.meta?.inGameDay != null) worldPatch.days = input.meta.inGameDay;
          return {
            worldSettings: input.settings ? applyParsed(s.worldSettings, input.settings) : s.worldSettings,
            worldSaves: { ...s.worldSaves, [worldId]: nextSave },
            worlds: s.worlds.map((w) => (w.id === worldId ? { ...w, ...worldPatch } : w)),
            logs: pushLog(s.logs, {
              level: "ok",
              source: "sav",
              message: `Imported ${input.fileName}${settingKeys.length ? ` (${settingKeys.length} world options)` : ""}.`,
            }),
          };
        });
        return settingKeys.length;
      },
      setEngineTweak: (id, patch) =>
        set((s) => ({
          engineTweaks: s.engineTweaks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),
      tickMonitor: () =>
        set((s) => {
          const fleet = fleetOf(s);
          const world = s.worlds.find((w) => w.active);
          const running = fleet.filter((i) => i.running);
          const players = running.reduce((n, i) => n + i.players.filter((p) => p.online).length, 0);
          const restOn = settingOn(s.worldSettings, "RESTAPIEnabled");
          const monitor = s.monitor ?? emptyMonitor();
          const sample = sampleAt(Date.now(), {
            running: running.length > 0,
            players,
            worldMb: world?.sizeMb ?? 0,
            restOn,
          });
          const ops = { ...defaultOps(), ...s.ops };
          const consoleLines = { ...(s.consoleLines ?? {}) };
          if (s.captureConsole !== false) {
            for (const inst of running) {
              const prev = consoleLines[inst.id] ?? [];
              const extra = prev.length
                ? [tickConsoleLine(inst.players.filter((p) => p.online).length, restOn)]
                : bootConsole(inst);
              const rows = extra.map((text) => ({
                id: nid("con"),
                ts: new Date().toISOString(),
                stream: "out" as const,
                text,
              }));
              consoleLines[inst.id] = [...prev, ...rows].slice(-120);
            }
          }
          return {
            monitor: {
              samples: appendSample(monitor.samples, sample),
              session: {
                ...monitor.session,
                peakPlayers: Math.max(monitor.session.peakPlayers, players),
              },
              thresholds: monitor.thresholds,
            },
            consoleLines,
            ops,
          };
        }),
      setMonitorThresholds: (patch) =>
        set((s) => {
          const monitor = s.monitor ?? emptyMonitor();
          return {
            monitor: { ...monitor, thresholds: { ...monitor.thresholds, ...patch } },
          };
        }),
      applyFix: (action, modId) => {
        if (action === "disable" && modId) {
          set((s) => ({
            mods: s.mods.map((m) => (m.id === modId ? { ...m, enabled: false } : m)),
            logs: pushLog(s.logs, {
              level: "info",
              source: "checker",
              message: `Disabled ${s.mods.find((m) => m.id === modId)?.name ?? "mod"}.`,
            }),
          }));
        }
        if (action === "update" && modId) get().updateMod(modId);
        if (action === "uninstall" && modId) get().uninstallMod(modId);
        if (action === "install-ue4ss") {
          const mode = get().mode;
          const side: InstallTarget = mode === "client" ? "client" : mode === "server" ? "server" : "both";
          get().installFramework("ue4ss", side, get().frameworks.ue4ss.latestKnown || "2281fa31", "UE4SS-Palworld.zip");
        }
        if (action === "install-palschema") {
          const mode = get().mode;
          const side: InstallTarget = mode === "client" ? "client" : mode === "server" ? "server" : "both";
          get().installFramework(
            "palschema",
            side,
            get().frameworks.palschema.latestKnown || "0.6.71",
            "PalSchema.zip",
          );
        }
      },
      setOps: (patch) => set((s) => ({ ops: { ...defaultOps(), ...s.ops, ...patch } })),
      pushConsole: (id, text, stream = "out") =>
        set((s) => ({
          consoleLines: {
            ...(s.consoleLines ?? {}),
            [id]: [
              ...(s.consoleLines?.[id] ?? []),
              { id: nid("con"), ts: new Date().toISOString(), stream, text },
            ].slice(-120),
          },
        })),
      clearConsole: (id) =>
        set((s) => {
          if (!id) return { consoleLines: {} };
          const next = { ...(s.consoleLines ?? {}) };
          delete next[id];
          return { consoleLines: next };
        }),
      saveProfile: (name, notes) =>
        set((s) => {
          const profile = snapshotProfile(name.trim() || "Loadout", notes ?? "", s.mods, nid("prof"));
          return {
            profiles: [profile, ...(s.profiles ?? [])],
            logs: pushLog(s.logs, { level: "ok", source: "mods", message: `Saved loadout ${profile.name}.` }),
          };
        }),
      applyProfileById: (id) => {
        const s = get();
        const profile = (s.profiles ?? []).find((p) => p.id === id);
        if (!profile) return "Loadout not found.";
        set((st) => ({
          mods: applyProfile(st.mods, profile),
          logs: pushLog(st.logs, { level: "ok", source: "mods", message: `Applied loadout ${profile.name}.` }),
        }));
        return null;
      },
      removeProfile: (id) => set((s) => ({ profiles: (s.profiles ?? []).filter((p) => p.id !== id) })),
      addBan: (entry) =>
        set((s) => ({
          bans: [
            { id: entry.id ?? nid("ban"), at: entry.at ?? new Date().toISOString(), steamId: entry.steamId, name: entry.name, reason: entry.reason },
            ...(s.bans ?? []),
          ],
          logs: pushLog(s.logs, { level: "warn", source: "ban", message: `Banned ${entry.name || entry.steamId}.` }),
        })),
      removeBan: (id) => set((s) => ({ bans: (s.bans ?? []).filter((b) => b.id !== id) })),
      setAllow: (ids) => set({ allow: ids }),
      kick: (playerId, serverId) =>
        set((s) => {
          const id = serverId || s.activeServerId || s.server.id;
          const inst = fleetOf(s).find((i) => i.id === id);
          if (!inst) return s;
          const next = patchInstance(s, id, { players: inst.players.filter((p) => p.playerId !== playerId) });
          return {
            ...next,
            logs: pushLog(s.logs, { level: "info", source: "rest", message: `Kicked ${playerId} from ${inst.name}.` }),
          };
        }),
      announce: (message, serverId) =>
        set((s) => ({
          logs: pushLog(s.logs, {
            level: "ok",
            source: "rest",
            message: `Broadcast on ${serverId || s.server.name}: ${message}`,
          }),
        })),
      saveWorldLive: (serverId) =>
        set((s) => ({
          logs: pushLog(s.logs, {
            level: "ok",
            source: "rest",
            message: `Save-world sent to ${serverId || s.server.name}.`,
          }),
        })),
      writeDenFiles: (serverId) =>
        set((s) => {
          const id = serverId || s.activeServerId || s.server.id;
          const next = patchInstance(s, id, { writtenAt: new Date().toISOString() });
          return {
            ...next,
            denSettings: { ...(s.denSettings ?? {}), [id]: s.worldSettings },
            logs: pushLog(s.logs, {
              level: "ok",
              source: "disk",
              message: `Wrote PalWorldSettings.ini, Engine.ini, WorldOption.sav, LevelMeta.sav, and launch args for ${next.server.name}.`,
            }),
          };
        }),
      snapshotSaved: (serverId) => {
        get().createBackup("manual", `Saved folder (${serverId || get().server.name})`);
        set((s) => ({
          lastBackupAt: new Date().toISOString(),
          backups: pruneBackups(s.backups, { ...defaultOps(), ...s.ops }.backupKeep || 7),
        }));
      },
      importBanlist: (text) => {
        const parsed = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
        set((s) => ({
          bans: [
            ...parsed.map((steamId) => ({
              id: nid("ban"),
              steamId,
              name: "",
              reason: "Imported",
              at: new Date().toISOString(),
            })),
            ...(s.bans ?? []),
          ],
        }));
        return parsed.length;
      },
      assignPlayerToGuild: (worldId, playerId, guildName) =>
        set((s) => {
          const prev = ensureSave(s.worldSaves, worldId);
          const player = prev.players.find((p) => p.id === playerId);
          if (!player) return s;
          const oldGuild = player.guild;
          const players = prev.players.map((p) => (p.id === playerId ? { ...p, guild: guildName } : p));
          let guilds = prev.guilds.map((g) => {
            let members = g.members;
            if (oldGuild && g.name === oldGuild) members = Math.max(0, members - 1);
            if (guildName && g.name === guildName) members += 1;
            return { ...g, members };
          });
          if (guildName && !guilds.some((g) => g.name === guildName)) {
            guilds = [...guilds, { id: nid("g"), name: guildName, owner: player.name, members: 1, bases: 0 }];
          }
          return {
            worldSaves: { ...s.worldSaves, [worldId]: { ...prev, players, guilds } },
            worlds: s.worlds.map((w) => (w.id === worldId ? { ...w, guilds: guilds.length } : w)),
            logs: pushLog(s.logs, {
              level: "ok",
              source: "worlds",
              message: guildName ? `Moved ${player.name} into ${guildName}.` : `Removed ${player.name} from ${oldGuild || "guild"}.`,
            }),
          };
        }),
      banPlayer: (playerId, serverId, reason) => {
        const s = get();
        const id = serverId || s.activeServerId || s.server.id;
        const inst = fleetOf(s).find((i) => i.id === id);
        const player = inst?.players.find((p) => p.playerId === playerId);
        get().addBan({
          steamId: playerId,
          name: player?.name || playerId,
          reason: reason || "Banned from dashboard",
        });
        get().kick(playerId, id);
      },
      resetAll: () => set({ ...emptyState(), hydrateReady: true }),
    }),
    {
      name: "palnest-v12",
      storage: createJSONStorage(() => ({
        getItem: (name) =>
          localStorage.getItem(name) ?? localStorage.getItem("palnest-v11") ?? localStorage.getItem("palnest-v10"),
        setItem: (name, value) => localStorage.setItem(name, value),
        removeItem: (name) => {
          localStorage.removeItem(name);
          localStorage.removeItem("palnest-v11");
          localStorage.removeItem("palnest-v10");
        },
      })),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (!state) {
          useAppStore.setState({ hydrateReady: true });
          return;
        }
        useAppStore.setState({
          worldSettings: mergeSettings(state.worldSettings),
          engineTweaks: mergeEngineTweaks(state.engineTweaks),
          worldSaves: state.worldSaves ?? {},
          ...migrateFleet({
            instances: state.instances,
            server: state.server
              ? { ...state.server, versions: SERVER_VERSIONS }
              : state.server,
            activeServerId: state.activeServerId,
            worlds: state.worlds,
          }),
          guideDismissed: Boolean(state.guideDismissed),
          checkerRan: Boolean(state.checkerRan),
          monitor: {
            samples: state.monitor?.samples?.length
              ? state.monitor.samples
              : seedHistory({
                  running: Boolean(state.server?.running),
                  startedAt: state.server?.startedAt ?? null,
                  players: state.server?.players?.filter((p) => p.online).length ?? 0,
                  worldMb: state.worlds?.find((w) => w.active)?.sizeMb ?? 0,
                  restOn: settingOn(state.worldSettings, "RESTAPIEnabled"),
                }),
            session: state.monitor?.session ?? emptyMonitor().session,
            thresholds: { ...DEFAULT_THRESHOLDS, ...state.monitor?.thresholds },
          },
          ops: {
            ...defaultOps(),
            ...state.ops,
            scheduleBackupMinutes:
              state.ops?.scheduleBackupMinutes && state.ops.scheduleBackupMinutes > 0
                ? state.ops.scheduleBackupMinutes
                : Math.max(10, Math.round((state.ops?.scheduleBackupHours ?? 6) * 60)),
            scheduleBackupOn: state.ops?.scheduleBackupOn !== false,
            scheduleRestartOn: Boolean(state.ops?.scheduleRestartOn),
            backupPath: state.ops?.backupPath ?? "",
          },
          profiles: state.profiles ?? [],
          bans: state.bans ?? [],
          allow: state.allow ?? [],
          consoleLines: state.consoleLines ?? {},
          denSettings: state.denSettings ?? {},
          lastBackupAt: state.lastBackupAt ?? null,
          lastRestartDay: state.lastRestartDay ?? "",
          hydrateReady: true,
        });
      },
      partialize: (s) => ({
        onboarded: s.onboarded,
        mode: s.mode,
        paths: s.paths,
        keys: s.keys,
        autoBackup: s.autoBackup,
        crashWatchdog: s.crashWatchdog,
        captureConsole: s.captureConsole,
        checkModUpdates: s.checkModUpdates,
        guideDismissed: s.guideDismissed,
        checkerRan: s.checkerRan,
        server: s.server,
        instances: s.instances,
        activeServerId: s.activeServerId,
        worlds: s.worlds,
        backups: s.backups,
        mods: s.mods,
        frameworks: s.frameworks,
        launchArgs: s.launchArgs,
        worldSettings: s.worldSettings,
        worldSaves: s.worldSaves,
        engineTweaks: s.engineTweaks,
        logs: s.logs,
        ops: s.ops,
        profiles: s.profiles,
        bans: s.bans,
        allow: s.allow,
        consoleLines: s.consoleLines,
        denSettings: s.denSettings,
        lastBackupAt: s.lastBackupAt,
        lastRestartDay: s.lastRestartDay,
        monitor: s.monitor
          ? { session: s.monitor.session, thresholds: s.monitor.thresholds, samples: s.monitor.samples.slice(-240) }
          : undefined,
      }),
    },
  ),
);
