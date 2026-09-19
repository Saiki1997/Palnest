import { renderArgv, renderCommandLine, tweaksToIni } from "./args";
import { instanceExe, overlayInstanceArgs } from "./fleet";
import { hostEnableMod, hostExtractZip, hostKind, hostLaunchGame, hostRest, hostSpawnAgent, hostSpawnPal, hostSteamcmd, hostStopAgent, hostStopPal, hostUdpListen, hostUpnp, hostWriteFile, hostZipDir, hostRestoreZip } from "./host";
import { tunnelAgentArgv } from "./listen";
import { settingsToIni } from "./ini";
import {
  formatBanlist,
  iniDiskPath,
  engineIniPath,
  linuxStartScript,
  parseRestMetrics,
  parseRestPlayers,
  restUrl,
  REST_PATHS,
  steamcmdUpdateArgs,
  steamcmdWorkshopArgs,
  type BanEntry,
} from "./ops";
import { encodeLevelMetaSav, encodeWorldOptionSav, levelMetaPath, worldOptionPath } from "./sav";
import { joinHost } from "./tunnels";
import type { EngineTweak, LaunchArg, PathsState, ServerState, WorldInfo, WorldSetting } from "./types";

export function denRoot(inst: Pick<ServerState, "installPath">, paths: PathsState) {
  return inst.installPath || paths.server || "";
}

export function palServerExe(inst: ServerState, paths: PathsState, linux = false) {
  const root = denRoot(inst, paths);
  if (linux) return `${root.replace(/[\\/]$/, "")}/PalServer.sh`;
  return instanceExe(inst, paths.server);
}

export function palClientExe(clientRoot: string, linux = false) {
  const root = clientRoot.replace(/[\\/]$/, "");
  return linux ? `${root}/Palworld.sh` : `${root}\\Palworld.exe`;
}

export async function spawnDenProcess(inst: ServerState, launchArgs: LaunchArg[], paths: PathsState, linux = false) {
  const exe = palServerExe(inst, paths, linux);
  const argv = renderArgv(overlayInstanceArgs(launchArgs, inst));
  const cwd = denRoot(inst, paths) || undefined;
  return hostSpawnPal(inst.id, exe, argv, cwd || "");
}

export async function stopDenProcess(id: string) {
  return hostStopPal(id);
}

export async function writeDenToDisk(input: {
  inst: ServerState;
  settings: WorldSetting[];
  world?: WorldInfo;
  paths: PathsState;
  launchArgs: LaunchArg[];
  bans: BanEntry[];
  allow: string[];
  linux?: boolean;
  engineTweaks?: EngineTweak[];
}) {
  const root = denRoot(input.inst, input.paths);
  if (!root) return { ok: false as const, error: "No PalServer folder." };
  const linux = Boolean(input.linux);
  const ini = settingsToIni(input.settings);
  const writes: Promise<unknown>[] = [
    hostWriteFile(iniDiskPath(root, linux), ini),
    hostWriteFile(
      `${root}\\Palnest.launch.txt`,
      renderCommandLine(palServerExe(input.inst, input.paths, linux), overlayInstanceArgs(input.launchArgs, input.inst)),
    ),
    hostWriteFile(`${root}\\Pal\\Saved\\SaveGames\\banlist.txt`, formatBanlist(input.bans)),
  ];
  if (input.engineTweaks?.length) {
    writes.push(hostWriteFile(engineIniPath(root, linux), tweaksToIni(input.engineTweaks, "server")));
  }
  if (input.allow.length) {
    writes.push(hostWriteFile(`${root}\\Pal\\Saved\\Config\\allowlist.txt`, `${input.allow.join("\n")}\n`));
  }
  if (input.world) {
    writes.push(
      encodeWorldOptionSav(input.settings).then((bytes) => hostWriteFile(worldOptionPath(root, input.world!.guid), bytes)),
      encodeLevelMetaSav({ worldName: input.world.name, inGameDay: input.world.days }).then((bytes) =>
        hostWriteFile(levelMetaPath(root, input.world!.guid), bytes),
      ),
    );
  }
  if (linux) {
    writes.push(
      hostWriteFile(
        `${root}/start-palnest.sh`,
        linuxStartScript(palServerExe(input.inst, input.paths, true), renderArgv(overlayInstanceArgs(input.launchArgs, input.inst)), input.inst.name),
      ),
    );
  }
  await Promise.all(writes);
  return { ok: true as const, simulated: hostKind() !== "desktop", root };
}

export async function zipSavedFolder(inst: ServerState, paths: PathsState, destDir?: string) {
  const root = denRoot(inst, paths);
  if (!root) return { ok: false as const, error: "No PalServer folder." };
  const destRoot = (destDir || "").trim() || `${root}\\PalnestBackups`;
  const dest = `${destRoot.replace(/[\\/]$/, "")}\\saved-${Date.now()}.zip`;
  return hostZipDir(`${root}\\Pal\\Saved`, dest);
}

export async function restoreSavedZip(zip: string, inst: ServerState, paths: PathsState) {
  const root = denRoot(inst, paths);
  if (!root) return { ok: false as const, error: "No PalServer folder." };
  return hostRestoreZip(zip, `${root}\\Pal\\Saved`);
}

export async function steamcmdDedicated(installDir: string, version: string, cwd?: string) {
  return hostSteamcmd(steamcmdUpdateArgs(installDir, version), cwd || installDir);
}

export async function steamcmdWorkshop(installDir: string, workshopId: string) {
  return hostSteamcmd(steamcmdWorkshopArgs(installDir, workshopId), installDir);
}

export async function enableModOnDisk(path: string, kind: string, on: boolean) {
  return hostEnableMod(path, kind, on);
}

export async function extractModZip(zip: string, dest: string) {
  return hostExtractZip(zip, dest);
}

export async function launchPalworld(clientRoot: string, inst: ServerState, linux = false) {
  const exe = palClientExe(clientRoot, linux);
  return hostLaunchGame(exe, joinHost(inst));
}

export async function spawnTunnelAgent(kind: "playit" | "portwarp", inst: ServerState, paths: PathsState) {
  const cwd = denRoot(inst, paths);
  const argv = tunnelAgentArgv(kind, inst, cwd);
  return hostSpawnAgent(kind, argv, cwd);
}

export async function probeDenListen(port: number) {
  return hostUdpListen(port);
}

export async function stopTunnelAgent(kind: "playit" | "portwarp") {
  return hostStopAgent(kind);
}

export async function mapUpnp(port: number, on: boolean) {
  return hostUpnp(port, on);
}

export function restCreds(settings: WorldSetting[]) {
  const pass = settings.find((s) => s.key === "AdminPassword")?.value || "admin";
  return { user: "admin", pass };
}

export async function restAnnounce(inst: ServerState, settings: WorldSetting[], message: string) {
  const { user, pass } = restCreds(settings);
  return hostRest(restUrl(inst.restPort, REST_PATHS.announce), "POST", { message }, user, pass);
}

export async function restKick(inst: ServerState, settings: WorldSetting[], playerId: string) {
  const { user, pass } = restCreds(settings);
  return hostRest(restUrl(inst.restPort, REST_PATHS.kick), "POST", { userid: playerId }, user, pass);
}

export async function restSave(inst: ServerState, settings: WorldSetting[]) {
  const { user, pass } = restCreds(settings);
  return hostRest(restUrl(inst.restPort, REST_PATHS.save), "POST", {}, user, pass);
}

export async function restPlayers(inst: ServerState, settings: WorldSetting[]) {
  const { user, pass } = restCreds(settings);
  const res = await hostRest(restUrl(inst.restPort, REST_PATHS.players), "GET", undefined, user, pass);
  const simulated = Boolean((res.body as { simulated?: boolean } | undefined)?.simulated);
  return { ...res, simulated, players: simulated ? [] : parseRestPlayers(res.body) };
}

export async function restMetrics(inst: ServerState, settings: WorldSetting[]) {
  const { user, pass } = restCreds(settings);
  const res = await hostRest(restUrl(inst.restPort, REST_PATHS.metrics), "GET", undefined, user, pass);
  const simulated = Boolean((res.body as { simulated?: boolean } | undefined)?.simulated);
  return { ...res, simulated, metrics: simulated ? null : parseRestMetrics(res.body) };
}

export function linuxScriptDownload(inst: ServerState, launchArgs: LaunchArg[], paths: PathsState) {
  return linuxStartScript(
    palServerExe(inst, paths, true),
    renderArgv(overlayInstanceArgs(launchArgs, inst)),
    inst.name,
  );
}
