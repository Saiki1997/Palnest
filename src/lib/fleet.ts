import { CURRENT_GAME } from "./catalog.ts";
import { queryPortArgForced } from "./listen.ts";
import { idleTunnel, tunnelLaunchFlags } from "./tunnels.ts";
import type { LaunchArg, ServerState, ServerVersion, TunnelState } from "./types.ts";
import { nid } from "./utils.ts";

export const PORT_STRIDE = 10;

export function portsForSlot(slot: number) {
  const n = Math.max(0, Math.floor(slot));
  return {
    port: 8211 + n * PORT_STRIDE,
    queryPort: 27015 + n,
    restPort: 8212 + n * PORT_STRIDE,
    rconPort: 25575 + n,
  };
}

export function nextSlot(instances: { slot?: number }[]) {
  const used = new Set(instances.map((i) => i.slot ?? 0));
  let slot = 0;
  while (used.has(slot)) slot += 1;
  return slot;
}

export type PortConflict = { otherId: string; otherName: string; port: number; label: string };

const PORT_LABELS = [
  ["port", "game UDP"],
  ["queryPort", "Steam query"],
  ["restPort", "REST"],
  ["rconPort", "RCON"],
] as const;

export function portConflicts(
  instances: ServerState[],
  candidate: Pick<ServerState, "id" | "port" | "queryPort" | "restPort" | "rconPort">,
  onlyRunning = true,
): PortConflict | null {
  const others = instances.filter((i) => i.id !== candidate.id && (!onlyRunning || i.running));
  for (const other of others) {
    for (const [key, label] of PORT_LABELS) {
      const port = candidate[key];
      if (!port) continue;
      for (const [okey] of PORT_LABELS) {
        if (other[okey] === port) {
          return { otherId: other.id, otherName: other.name, port, label };
        }
      }
    }
  }
  return null;
}

export function isStalePortClaim(
  inst: Pick<ServerState, "running" | "listenAt" | "pid" | "startedAt">,
  now = Date.now(),
) {
  if (!inst.running) return true;
  if (inst.listenAt || inst.pid) return false;
  const started = inst.startedAt ? new Date(inst.startedAt).getTime() : 0;
  if (!started) return true;
  return now - started > 90_000;
}

export function worldBusy(instances: ServerState[], worldId: string, exceptId?: string) {
  if (!worldId) return undefined;
  return instances.find((i) => i.id !== exceptId && i.running && i.worldId === worldId);
}

export function fleetOf(state: { instances?: ServerState[]; server?: ServerState | null }) {
  if (state.instances?.length) return state.instances;
  if (state.server) return [normalizeInstance(state.server)];
  return [];
}

export function activeOf(state: { instances?: ServerState[]; server?: ServerState | null; activeServerId?: string }) {
  const fleet = fleetOf(state);
  if (!fleet.length) return normalizeInstance({});
  return fleet.find((i) => i.id === state.activeServerId) ?? fleet[0];
}

export function normalizeTunnel(raw: Partial<TunnelState> | undefined, localPort: number): TunnelState {
  const base = idleTunnel(localPort, raw?.provider ?? "none");
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    localPort: raw.localPort || localPort,
    game: raw.game ?? null,
    query: raw.query ?? null,
  };
}

export function normalizeInstance(raw: Partial<ServerState>, versions: ServerVersion[] = raw.versions ?? []): ServerState {
  const slot = raw.slot ?? 0;
  const ports = portsForSlot(slot);
  const id = raw.id || "srv-primary";
  const port = raw.port || ports.port;
  return {
    id,
    name: raw.name || "Palnest World",
    description: raw.description || "A well-kept island.",
    running: Boolean(raw.running),
    startedAt: raw.startedAt ?? null,
    version: raw.version || CURRENT_GAME,
    build: raw.build || "1120515",
    port,
    queryPort: raw.queryPort || ports.queryPort,
    restPort: raw.restPort || ports.restPort,
    rconPort: raw.rconPort || ports.rconPort,
    maxPlayers: raw.maxPlayers || 32,
    community: Boolean(raw.community),
    publicIp: raw.publicIp || "",
    players: raw.players ?? [],
    versions: raw.versions?.length ? raw.versions : versions,
    history: raw.history?.length ? raw.history : [raw.version || CURRENT_GAME],
    imported: Boolean(raw.imported),
    importedFrom: raw.importedFrom || "",
    installPath: raw.installPath || raw.importedFrom || "",
    worldId: raw.worldId || "",
    slot,
    notes: raw.notes || "",
    tunnel: normalizeTunnel(raw.tunnel, port),
    pid: raw.pid ?? null,
    layout: raw.layout === "shared" ? "shared" : "copy",
    autostart: Boolean(raw.autostart),
    writtenAt: raw.writtenAt ?? null,
    listenAt: raw.listenAt ?? null,
    queryBound: Boolean(raw.queryBound),
    joinMotd: raw.joinMotd || "",
  };
}

export function migrateFleet(state: {
  instances?: ServerState[];
  server?: ServerState | null;
  activeServerId?: string;
  worlds?: { id: string; active?: boolean }[];
  versions?: ServerVersion[];
}) {
  const versions = state.server?.versions ?? state.instances?.[0]?.versions ?? [];
  const fallbackWorld = state.worlds?.find((w) => w.active)?.id ?? state.worlds?.[0]?.id ?? "";
  let instances = (state.instances?.length ? state.instances : state.server ? [state.server] : []).map((raw, i) =>
    normalizeInstance(
      {
        ...raw,
        slot: raw.slot ?? i,
        worldId: raw.worldId || fallbackWorld,
        installPath: raw.installPath || raw.importedFrom || "",
      },
      versions,
    ),
  );
  if (!instances.length) {
    instances = [normalizeInstance({ worldId: fallbackWorld }, versions)];
  }
  const ids = new Set<string>();
  instances = instances.map((inst, i) => {
    let id = inst.id;
    if (!id || ids.has(id)) id = i === 0 ? "srv-primary" : nid("srv");
    ids.add(id);
    return { ...inst, id, slot: inst.slot ?? i };
  });
  const activeServerId =
    (state.activeServerId && instances.some((i) => i.id === state.activeServerId) && state.activeServerId) ||
    instances.find((i) => i.running)?.id ||
    instances[0].id;
  const server = instances.find((i) => i.id === activeServerId) ?? instances[0];
  return { instances, activeServerId: server.id, server };
}

export function patchInstance(
  state: { instances?: ServerState[]; server: ServerState; activeServerId?: string },
  id: string,
  patch: Partial<ServerState> | ((inst: ServerState) => ServerState),
) {
  const migrated = migrateFleet(state);
  const instances = migrated.instances.map((inst) => {
    if (inst.id !== id) return inst;
    return typeof patch === "function" ? patch(inst) : normalizeInstance({ ...inst, ...patch }, inst.versions);
  });
  const server = instances.find((i) => i.id === migrated.activeServerId) ?? instances[0];
  return { instances, activeServerId: migrated.activeServerId, server };
}

export function suggestedInstallPath(base: string, name: string) {
  const slug = name.replace(/[<>:"/\\|?*]+/g, "").trim() || "PalnestWorld";
  const root = (base || "C:\\PalServers").replace(/\\+$/g, "");
  if (/PalServer/i.test(root) && /\\/.test(root)) {
    const parent = root.replace(/\\[^\\]+$/, "");
    return `${parent}\\${slug}`;
  }
  return `${root}\\${slug}`;
}

export function overlayInstanceArgs(args: LaunchArg[], instance: ServerState): LaunchArg[] {
  const flags = tunnelLaunchFlags(instance.tunnel);
  const publicIp = flags.publicIp || instance.publicIp;
  const publicPort = flags.publicPort;
  const havePublicIp = args.some((a) => a.id === "publicip");
  const havePublicPort = args.some((a) => a.id === "publicport");
  const next = args.map((a) => {
    if (a.id === "port") return { ...a, value: String(instance.port), enabled: true };
    if (a.id === "queryport") {
      return { ...a, value: String(instance.queryPort), enabled: queryPortArgForced(instance.version) ? true : a.enabled };
    }
    if (a.id === "players") return { ...a, value: String(instance.maxPlayers), enabled: true };
    if (a.id === "publiclobby") return { ...a, enabled: instance.community || instance.tunnel.status === "online" };
    if (a.id === "publicip") return { ...a, value: publicIp, enabled: Boolean(publicIp) };
    if (a.id === "publicport")
      return { ...a, value: publicPort ? String(publicPort) : a.value, enabled: Boolean(publicPort) };
    return a;
  });
  if (publicIp && !havePublicIp) {
    next.push({
      id: "publicip",
      flag: "-publicip",
      value: publicIp,
      enabled: true,
      note: "Public IP from the tunnel. Required for the community list.",
      category: "network",
      builtin: true,
    });
  }
  if (publicPort && !havePublicPort) {
    next.push({
      id: "publicport",
      flag: "-publicport",
      value: String(publicPort),
      enabled: true,
      note: "Public port from the tunnel. Must match the playit / PortWarp assignment.",
      category: "network",
      builtin: true,
    });
  }
  return next;
}

export function instanceExe(instance: ServerState, fallbackRoot: string) {
  const root = (instance.installPath || fallbackRoot || "%SERVER%").replace(/[\\/]$/, "");
  return `${root}\\PalServer.exe`;
}

export function runningCount(instances: ServerState[]) {
  return instances.filter((i) => i.running).length;
}
