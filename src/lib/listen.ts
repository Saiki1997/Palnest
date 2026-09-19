import { cmpGameVersion } from "./catalog.ts";
import { slugHost } from "./tunnels.ts";
import type { ServerState } from "./types.ts";

/** Older PalServer (EA / early 1.0) binds UDP only after the world loads. Newer 1.0.4+ is faster. */
export function denListenMs(version: string) {
  if (cmpGameVersion(version, "1.0.0") < 0) return 5200;
  if (cmpGameVersion(version, "1.0.4") < 0) return 3800;
  if (cmpGameVersion(version, "1.0.5") < 0) return 1800;
  return 1200;
}

/** Desktop wait ceiling. Older islands can sit on world load for well over a minute. */
export const DEN_LISTEN_TIMEOUT_MS = 180_000;

/** Steam query on 0.7.x is often TCP 27015, which PortWarp A2S (UDP) will never see. */
export function queryPortUdpLikely(version: string) {
  return cmpGameVersion(version, "1.0.0") >= 0 && cmpGameVersion(version, "1.0.4") < 0;
}

/** `-queryport` is a community flag. Official 1.0.4+ launch notes omit it. */
export function queryPortArgForced(version: string) {
  return cmpGameVersion(version, "1.0.4") < 0;
}

export function isSlowListenBuild(version: string) {
  return cmpGameVersion(version, "1.0.4") < 0;
}

const LISTEN_LINE =
  /\[PALNEST\].*bound UDP|Running Palworld dedicated server|LogNet:\s*(Name:\s*Pal|InitBase|IpNetDriver|Listen)|GameServer.*logged on|SteamGameServerReady|LogPal:.*[Dd]edicated server/i;

const EARLY_LINE = /breakpad minidump|Game version is v/i;

export function isListenLine(text: string) {
  const line = text.trim();
  if (!line || EARLY_LINE.test(line)) return false;
  return LISTEN_LINE.test(line);
}

export function bootWarmupLines(inst: Pick<ServerState, "name" | "version" | "port" | "build">) {
  const slow = isSlowListenBuild(inst.version);
  return [
    `Setting breakpad minidump AppID = 2394010`,
    `Game version is v${inst.version}.${inst.build || "0"}`,
    `[PALNEST] ${inst.name} starting PalServer ${inst.version} — waiting for UDP ${inst.port}${
      slow ? " (older builds bind after world load, not at process start)" : ""
    }`,
  ];
}

export function bootListenLines(inst: Pick<ServerState, "name" | "version" | "port" | "build">) {
  return [
    `Running Palworld dedicated server on :${inst.port}`,
    `[PALNEST] ${inst.name} bound UDP ${inst.port}`,
    `LogNet: Name: Pal, InitBase: 1`,
  ];
}

export function denListenLabel(inst: Pick<ServerState, "running" | "listenAt" | "version" | "port">) {
  if (!inst.running) return "";
  if (inst.listenAt) return `UDP ${inst.port} bound`;
  return isSlowListenBuild(inst.version)
    ? `Waiting for UDP ${inst.port} — older PalServer binds after world load`
    : `Waiting for UDP ${inst.port}`;
}

export type TunnelKind = "playit" | "portwarp";

/**
 * PortWarp CLI (`pwrp start --udp PORT`). Do not pass a Palworld/A2S preset —
 * auto-detect waits on Steam query, which older PalServer binds late or as TCP.
 * Repeat `--udp` for a query extra only when that port is actually listening UDP.
 */
export function portwarpArgv(inst: Pick<ServerState, "name" | "port" | "queryPort" | "queryBound">) {
  const argv = ["start", "--udp", String(inst.port)];
  if (inst.queryBound && inst.queryPort && inst.queryPort !== inst.port) {
    argv.push("--udp", String(inst.queryPort));
  }
  return argv;
}

export function playitArgv(cwd: string) {
  return ["--secret_path", `${cwd}\\playit.toml`];
}

export function tunnelAgentArgv(
  kind: TunnelKind,
  inst: Pick<ServerState, "name" | "port" | "queryPort" | "queryBound">,
  cwd: string,
) {
  return kind === "playit" ? playitArgv(cwd) : portwarpArgv(inst);
}

export function portwarpAttachNote(inst: Pick<ServerState, "port" | "queryPort" | "queryBound" | "version">) {
  if (inst.queryBound) {
    return `[PALNEST] UDP ${inst.port} bound. Starting PortWarp on the game port plus query ${inst.queryPort} (explicit map, no A2S auto-detect).`;
  }
  return `[PALNEST] UDP ${inst.port} bound. Starting PortWarp on the game port only — Steam query ${inst.queryPort} is not listening as UDP on this build, so the agent will not wait on A2S.`;
}

export type ListenProbe = { bound: boolean; transport: "udp" | "tcp" | "none"; simulated?: boolean };

export function simulatedListenProbe(
  inst: Pick<ServerState, "listenAt" | "startedAt" | "running" | "version">,
  now = Date.now(),
): ListenProbe {
  if (!inst.running) return { bound: false, transport: "none", simulated: true };
  if (inst.listenAt) return { bound: true, transport: "udp", simulated: true };
  const started = inst.startedAt ? new Date(inst.startedAt).getTime() : 0;
  if (started && now - started >= denListenMs(inst.version)) {
    return { bound: true, transport: "udp", simulated: true };
  }
  return { bound: false, transport: "none", simulated: true };
}
