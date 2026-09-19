import { bootWarmupLines } from "./listen.ts";
import type { InstalledMod, PlayerInfo, ServerState } from "./types.ts";

export const DEDICATED_APP = 2394010;
export const GAME_APP = 1623730;
export const WORKSHOP_APP = 1623730;

/** Known dedicated depots Palnest can pin for rollback. */
export const DEPOT_PINS: Record<string, { depot: string; manifest: string; note: string }> = {
  "1.0.5": { depot: "2394011", manifest: "1120515", note: "Current 1.0.5 dedicated." },
  "1.0.4": { depot: "2394011", manifest: "1108401", note: "1.0.4 dedicated rollback." },
  "1.0.2": { depot: "2394011", manifest: "1009930", note: "1.0.2 dedicated." },
  "1.0.0": { depot: "2394011", manifest: "980110", note: "1.0.0 launch dedicated." },
  "0.7.3": { depot: "2394011", manifest: "870221", note: "Last Early Access. Rollback only." },
};

export const REST_PATHS = {
  info: "/v1/api/info",
  metrics: "/v1/api/metrics",
  players: "/v1/api/players",
  announce: "/v1/api/announce",
  kick: "/v1/api/kick",
  ban: "/v1/api/ban",
  unban: "/v1/api/unban",
  save: "/v1/api/save",
  shutdown: "/v1/api/shutdown",
};

export type Locale = "en" | "ja" | "zh";
export type InstallLayout = "shared" | "copy";
export type Ue4ssChannel = "stable" | "experimental";

export interface OpsState {
  locale: Locale;
  layout: InstallLayout;
  autostart: boolean;
  startTunnels: boolean;
  scheduleRestart: string;
  scheduleRestartOn: boolean;
  scheduleBackupHours: number;
  scheduleBackupMinutes: number;
  scheduleBackupOn: boolean;
  backupKeep: number;
  backupPath: string;
  webhook: string;
  steamcmd: string;
  ue4ssChannel: Ue4ssChannel;
  linuxHost: boolean;
  upnp: boolean;
  tray: boolean;
}

export interface ModProfile {
  id: string;
  name: string;
  notes: string;
  enabledIds: string[];
}

export interface BanEntry {
  id: string;
  steamId: string;
  name: string;
  reason: string;
  at: string;
}

export interface ConsoleLine {
  id: string;
  ts: string;
  stream: "out" | "err";
  text: string;
}

export interface ModConflict {
  id: string;
  title: string;
  detail: string;
  a: string;
  b: string;
}

export function defaultOps(): OpsState {
  return {
    locale: "en",
    layout: "copy",
    autostart: false,
    startTunnels: true,
    scheduleRestart: "",
    scheduleRestartOn: false,
    scheduleBackupHours: 6,
    scheduleBackupMinutes: 360,
    scheduleBackupOn: true,
    backupKeep: 7,
    backupPath: "",
    webhook: "",
    steamcmd: "",
    ue4ssChannel: "stable",
    linuxHost: false,
    upnp: false,
    tray: true,
  };
}

export function steamLibraryCandidates() {
  return [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    "D:\\Steam",
    "E:\\Steam",
    `${process.env.HOME || ""}/.steam/steam`,
    `${process.env.HOME || ""}/.local/share/Steam`,
  ].filter(Boolean);
}

export function palworldFromSteam(steamRoot: string) {
  const common = `${steamRoot.replace(/[\\/]$/, "")}\\steamapps\\common`;
  return {
    client: `${common}\\Palworld`,
    server: `${common}\\PalServer`,
  };
}

export const CURRENT_DEDICATED = "1.0.5";

export function steamcmdUpdateArgs(installDir: string, version: string, validate = true) {
  const pin = DEPOT_PINS[version];
  const args = ["+force_install_dir", installDir, "+login", "anonymous"];
  if (pin && version !== CURRENT_DEDICATED) {
    args.push("+download_depot", String(DEDICATED_APP), pin.depot, pin.manifest);
  } else {
    args.push("+app_update", String(DEDICATED_APP));
    if (validate) args.push("validate");
  }
  args.push("+quit");
  return args;
}

export function steamcmdWorkshopArgs(installDir: string, workshopId: string) {
  return [
    "+force_install_dir",
    installDir,
    "+login",
    "anonymous",
    "+workshop_download_item",
    String(WORKSHOP_APP),
    workshopId,
    "+quit",
  ];
}

export function enabledTxt(on: boolean) {
  return on ? "1" : "0";
}

export function pakDiskName(path: string, enabled: boolean) {
  const clean = path.replace(/\.pak\.off$/i, ".pak").replace(/\.pak$/i, ".pak");
  return enabled ? clean : clean.replace(/\.pak$/i, ".pak.off");
}

export function findConflicts(mods: InstalledMod[]): ModConflict[] {
  const live = mods.filter((m) => m.enabled);
  const out: ModConflict[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const aBase = baseName(a.installPath || a.name);
      const bBase = baseName(b.installPath || b.name);
      if (a.kind === b.kind && aBase && aBase === bBase) {
        out.push({
          id: `${a.id}-${b.id}-file`,
          title: `Same ${a.kind} file`,
          detail: `${a.name} and ${b.name} both land on ${aBase}.`,
          a: a.id,
          b: b.id,
        });
      }
      if (a.kind === "palschema" && b.kind === "palschema" && a.category && a.category === b.category && a.category !== "Detected") {
        out.push({
          id: `${a.id}-${b.id}-schema`,
          title: "PalSchema row overlap",
          detail: `${a.name} and ${b.name} both touch ${a.category} packs. Check JSON rows before a live boot.`,
          a: a.id,
          b: b.id,
        });
      }
    }
  }
  return out;
}

function baseName(p: string) {
  return p.split(/[\\/]/).pop()?.toLowerCase() ?? "";
}

export function applyProfile(mods: InstalledMod[], profile: ModProfile): InstalledMod[] {
  const set = new Set(profile.enabledIds);
  return mods.map((m) => ({ ...m, enabled: set.has(m.id) }));
}

export function snapshotProfile(name: string, notes: string, mods: InstalledMod[], id: string): ModProfile {
  return {
    id,
    name,
    notes,
    enabledIds: mods.filter((m) => m.enabled).map((m) => m.id),
  };
}

export function formatBanlist(entries: BanEntry[]) {
  return entries.map((e) => e.steamId).filter(Boolean).join("\n") + (entries.length ? "\n" : "");
}

export function parseBanlist(text: string): BanEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((steamId, i) => ({
      id: `ban-${i}-${steamId.slice(-6)}`,
      steamId,
      name: "",
      reason: "Imported",
      at: new Date().toISOString(),
    }));
}

export function dueSchedule(hhmm: string, now = new Date(), lastFireDay = "") {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return false;
  const [h, m] = hhmm.split(":").map(Number);
  const day = now.toISOString().slice(0, 10);
  if (lastFireDay === day) return false;
  return now.getHours() === h && now.getMinutes() === m;
}

export function backupDue(lastIso: string | null, minutes: number, now = Date.now()) {
  if (!minutes || minutes <= 0) return false;
  if (!lastIso) return true;
  return now - new Date(lastIso).getTime() >= minutes * 60 * 1000;
}

export function pruneBackups<T extends { createdAt: string }>(list: T[], keep: number) {
  return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, Math.max(1, keep));
}

export function linuxStartScript(exeHint: string, argv: string[], name: string) {
  const flags = argv.join(" ");
  return `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export LD_LIBRARY_PATH="$PWD/linux64:\${LD_LIBRARY_PATH:-}"
exec ./PalServer.sh ${flags}
# ${name} — generated by Palnest
`;
}

export function bootConsole(inst: Pick<ServerState, "name" | "version" | "port" | "build">): string[] {
  return bootWarmupLines(inst);
}

export function tickConsoleLine(players: number, restOn: boolean) {
  const pool = [
    `LogPal: Display: WorldSave completed.`,
    restOn ? `LogHttp: REST /v1/api/metrics 200` : `LogNet: AddClientConnection`,
    players ? `LogPal: Player tick ${players} connections` : `LogPal: No connections`,
    `LogStreaming: Flush async loads`,
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function crashLine() {
  return "Fatal error: LowLevelFatalError [File:PalGameInstance.cpp] PalServer watchdog trip";
}

export function webhookPayload(kind: "join" | "leave" | "crash" | "backup" | "start" | "stop", text: string) {
  const colors = { join: 0x5ec2a0, leave: 0x8b9a91, crash: 0xc45b5b, backup: 0xc4a46a, start: 0x7dba8c, stop: 0x8b9a91 };
  return {
    username: "Palnest",
    embeds: [{ title: kind[0].toUpperCase() + kind.slice(1), description: text, color: colors[kind] }],
  };
}

export function restUrl(port: number, path: string) {
  return `http://127.0.0.1:${port}${path}`;
}

export function parseRestPlayers(body: unknown): PlayerInfo[] {
  const bag = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const raw = Array.isArray(body) ? body : Array.isArray(bag.players) ? bag.players : [];
  return raw
    .map((row) => {
      const p = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        name: String(p.name ?? "Player"),
        playerId: String(p.playerId ?? p.userId ?? p.steamid ?? ""),
        level: Number(p.level ?? 1) || 1,
        ping: Number(p.ping ?? 0) || 0,
        location:
          p.location_x != null ? `${Number(p.location_x).toFixed(0)}, ${Number(p.location_y ?? 0).toFixed(0)}` : "—",
        guild: String(p.guild ?? ""),
        online: true,
      };
    })
    .filter((p) => p.playerId || p.name !== "Player");
}

export function parseRestMetrics(body: unknown) {
  const p = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const fps = Number(p.serverfps ?? p.fps);
  const frame = Number(p.serverframetime ?? p.frameMs);
  return {
    fps: Number.isFinite(fps) && fps > 0 ? fps : null,
    players: Number(p.currentplayernum ?? p.players ?? 0) || 0,
    frameMs: Number.isFinite(frame) && frame > 0 ? frame : fps > 0 ? Number((1000 / fps).toFixed(1)) : null,
    uptime: Number(p.uptime ?? 0) || 0,
  };
}

export function modExtractDest(root: string, kind: string, linux = false) {
  const win = linux ? "Linux" : "Win64";
  const base = root.replace(/[\\/]$/, "");
  if (kind === "pak") return `${base}\\Pal\\Content\\Paks\\~mods`;
  if (kind === "palschema") return `${base}\\Pal\\Binaries\\${win}\\ue4ss\\Mods\\PalSchema\\mods`;
  return `${base}\\Pal\\Binaries\\${win}\\ue4ss\\Mods`;
}

export { guessZipKind } from "./mod-kind.ts";

export function kickPlayer(players: PlayerInfo[], playerId: string) {
  return players.filter((p) => p.playerId !== playerId);
}

export function diskKindLabel(kind: InstalledMod["kind"]) {
  if (kind === "ue4ss") return "enabled.txt";
  if (kind === "pak") return ".pak / .pak.off";
  if (kind === "palschema") return "PalSchema pack folder";
  return "mod files";
}

export function sharedSavedPath(serverRoot: string, worldGuid: string) {
  return `${serverRoot.replace(/[\\/]$/, "")}\\Pal\\Saved\\SaveGames\\0\\${worldGuid}`;
}

export function iniDiskPath(serverRoot: string, linux = false) {
  const folder = linux ? "LinuxServer" : "WindowsServer";
  return `${serverRoot.replace(/[\\/]$/, "")}\\Pal\\Saved\\Config\\${folder}\\PalWorldSettings.ini`;
}

export function engineIniPath(serverRoot: string, linux = false) {
  const folder = linux ? "LinuxServer" : "WindowsServer";
  return `${serverRoot.replace(/[\\/]$/, "")}\\Pal\\Saved\\Config\\${folder}\\Engine.ini`;
}

export function argvFromCommand(command: string) {
  const parts: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(command))) parts.push(m[1] ?? m[2]);
  return parts.slice(1);
}
