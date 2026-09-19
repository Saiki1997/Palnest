import { formatUptime, timeAgo } from "./utils.ts";
import type { BackupInfo, WorldInfo, WorldSaveData } from "./types.ts";

export const HOST_RAM_GB = 16;

export function ramFromPct(pct: number) {
  return Number(((pct / 100) * HOST_RAM_GB).toFixed(1));
}

export type HistoryRange = "15m" | "1h" | "6h";

export interface MetricSample {
  t: number;
  running: boolean;
  hostCpu: number;
  hostRamPct: number;
  procCpu: number;
  procRamGb: number;
  threads: number;
  fps: number | null;
  frameMs: number | null;
  players: number;
  worldMb: number;
  diskUsedPct: number;
  diskFreeGb: number;
  restart?: boolean;
}

export interface SessionStats {
  peakPlayers: number;
  joins: number;
  leaves: number;
  unique: number;
  lastTransition: string | null;
}

export interface MonitorThresholds {
  cpu: number;
  memory: number;
  disk: number;
  fps: number;
  sustainSec: number;
}

export interface ResourceAlert {
  id: string;
  kind: "cpu" | "memory" | "disk" | "fps";
  severity: "warn" | "error";
  title: string;
  detail: string;
  at: string;
  active: boolean;
}

export interface WorldPulse {
  day: number;
  clock: string;
  saveLabel: string;
  backupLabel: string;
  uptime: string;
  players: number;
  peakPlayers: number;
  joins: number;
  leaves: number;
  unique: number;
  lastTransition: string | null;
  worldName: string;
  health: "running" | "stopped" | "degraded";
  restOn: boolean;
}

export interface MonitorState {
  samples: MetricSample[];
  session: SessionStats;
  thresholds: MonitorThresholds;
}

export interface DiskForecast {
  freeGb: number;
  usedPct: number;
  note: string;
}

export const HISTORY_MS: Record<HistoryRange, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
};

export const DEFAULT_THRESHOLDS: MonitorThresholds = {
  cpu: 80,
  memory: 85,
  disk: 90,
  fps: 18,
  sustainSec: 20,
};

export const EMPTY_SESSION: SessionStats = {
  peakPlayers: 0,
  joins: 0,
  leaves: 0,
  unique: 0,
  lastTransition: null,
};

export const MAX_SAMPLES = 720;

export function emptyMonitor(): MonitorState {
  return { samples: [], session: { ...EMPTY_SESSION }, thresholds: { ...DEFAULT_THRESHOLDS } };
}

export function settingOn(settings: { key: string; value: string }[] | undefined, key: string) {
  return settings?.find((s) => s.key === key)?.value === "True";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function sampleAt(
  t: number,
  input: { running: boolean; players: number; worldMb: number; restOn: boolean; restart?: boolean },
): MetricSample {
  if (!input.running) {
    return {
      t,
      running: false,
      hostCpu: 4 + hash(t / 9000) * 3,
      hostRamPct: 28,
      procCpu: 0,
      procRamGb: 0,
      threads: 0,
      fps: null,
      frameMs: null,
      players: 0,
      worldMb: input.worldMb,
      diskUsedPct: Number((36 + input.worldMb / 80).toFixed(1)),
      diskFreeGb: Number((328 - input.worldMb / 1024).toFixed(1)),
    };
  }
  const wave = Math.sin(t / 42000);
  const jitter = (hash(t / 1300) - 0.5) * 6;
  const load = input.players * 3.1;
  const procCpu = clamp(11 + load + wave * 7 + jitter, 4, 97);
  const procRamGb = clamp(6.4 + input.players * 0.38 + wave * 0.15, 4.8, 18);
  const hostCpu = clamp(procCpu + 8 + hash(t / 5000) * 5, 8, 99);
  const hostRamPct = clamp(32 + procRamGb * 2.4, 20, 96);
  const fpsBase = input.restOn ? clamp(31.5 - input.players * 0.35 - Math.max(0, procCpu - 55) * 0.12, 8, 32) : null;
  return {
    t,
    running: true,
    hostCpu: Number(hostCpu.toFixed(1)),
    hostRamPct: Number(hostRamPct.toFixed(1)),
    procCpu: Number(procCpu.toFixed(1)),
    procRamGb: Number(procRamGb.toFixed(2)),
    threads: 46 + input.players * 3,
    fps: fpsBase == null ? null : Number(fpsBase.toFixed(1)),
    frameMs: fpsBase == null ? null : Number((1000 / fpsBase).toFixed(1)),
    players: input.players,
    worldMb: input.worldMb,
    diskUsedPct: Number((36 + input.worldMb / 80).toFixed(1)),
    diskFreeGb: Number((328 - input.worldMb / 1024).toFixed(1)),
    restart: input.restart,
  };
}

export function overlayHost(
  sample: MetricSample,
  host: { cpu: number; ramMb: number },
  rest?: { fps: number | null; frameMs: number | null; players?: number },
): MetricSample {
  return {
    ...sample,
    procCpu: host.cpu || sample.procCpu,
    procRamGb: host.ramMb ? Number((host.ramMb / 1024).toFixed(2)) : sample.procRamGb,
    fps: rest?.fps ?? sample.fps,
    frameMs: rest?.frameMs ?? sample.frameMs,
    players: rest?.players ?? sample.players,
  };
}

export function seedHistory(input: {
  running: boolean;
  startedAt: string | null;
  players: number;
  worldMb: number;
  restOn: boolean;
  now?: number;
}): MetricSample[] {
  const now = input.now ?? Date.now();
  const span = HISTORY_MS["6h"];
  const step = 30_000;
  const out: MetricSample[] = [];
  const start = now - span;
  for (let t = start; t <= now; t += step) {
    const running = Boolean(input.running && input.startedAt && t >= new Date(input.startedAt).getTime());
    const restart = Boolean(input.startedAt && Math.abs(t - new Date(input.startedAt).getTime()) < step);
    out.push(sampleAt(t, { ...input, running, restart }));
  }
  return out.slice(-MAX_SAMPLES);
}

export function appendSample(samples: MetricSample[], next: MetricSample): MetricSample[] {
  const last = samples[samples.length - 1];
  if (last && next.t - last.t < 2500) return samples;
  return [...samples, next].slice(-MAX_SAMPLES);
}

export function filterRange(samples: MetricSample[], range: HistoryRange, now = Date.now()) {
  const from = now - HISTORY_MS[range];
  return samples.filter((s) => s.t >= from);
}

export function downsample(samples: MetricSample[], max = 96): MetricSample[] {
  if (samples.length <= max) return samples;
  const step = (samples.length - 1) / (max - 1);
  const picked = new Map<number, MetricSample>();
  for (let i = 0; i < max; i++) {
    const idx = Math.round(i * step);
    picked.set(idx, samples[idx]!);
  }
  samples.forEach((s, i) => {
    if (s.restart) picked.set(i, s);
  });
  return [...picked.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, s]) => s);
}

export function summarize(samples: MetricSample[]) {
  const live = samples.filter((s) => s.running);
  if (!live.length) return { cpuAvg: 0, cpuPeak: 0, ramAvg: 0, ramPeak: 0, fpsAvg: null as number | null };
  const cpu = live.map((s) => s.procCpu);
  const ram = live.map((s) => s.procRamGb);
  const fps = live.map((s) => s.fps).filter((n): n is number => n != null);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    cpuAvg: avg(cpu),
    cpuPeak: Math.max(...cpu),
    ramAvg: avg(ram),
    ramPeak: Math.max(...ram),
    fpsAvg: fps.length ? avg(fps) : null,
  };
}

export function evaluateAlerts(samples: MetricSample[], thresholds: MonitorThresholds, now = Date.now()): ResourceAlert[] {
  const windowMs = thresholds.sustainSec * 1000;
  const recent = samples.filter((s) => s.t >= now - windowMs && s.running);
  if (recent.length < 3) return [];
  const alerts: ResourceAlert[] = [];
  const avg = (key: keyof MetricSample) =>
    recent.reduce((a, s) => a + (Number(s[key]) || 0), 0) / recent.length;

  const cpu = avg("procCpu");
  if (cpu >= thresholds.cpu) {
    alerts.push({
      id: "cpu",
      kind: "cpu",
      severity: cpu >= thresholds.cpu + 10 ? "error" : "warn",
      title: `PalServer CPU ${cpu.toFixed(0)}% for ${thresholds.sustainSec}s`,
      detail: "Sustained process load. Drop spawn rate or trim PalSchema packs before tick hitching.",
      at: new Date(now).toISOString(),
      active: true,
    });
  }
  const ram = recent[recent.length - 1]?.procRamGb ?? 0;
  const ramPct = recent[recent.length - 1]?.hostRamPct ?? 0;
  if (ramPct >= thresholds.memory) {
    alerts.push({
      id: "memory",
      kind: "memory",
      severity: ramPct >= thresholds.memory + 8 ? "error" : "warn",
      title: `Host memory ${ramPct.toFixed(0)}% (${ram.toFixed(1)} GB PalServer)`,
      detail: "1.0 map is roughly double Early Access. Snapshot the world if this holds.",
      at: new Date(now).toISOString(),
      active: true,
    });
  }
  const disk = recent[recent.length - 1]?.diskUsedPct ?? 0;
  if (disk >= thresholds.disk) {
    const free = recent[recent.length - 1]?.diskFreeGb ?? 0;
    alerts.push({
      id: "disk",
      kind: "disk",
      severity: disk >= 95 ? "error" : "warn",
      title: `Disk ${disk.toFixed(0)}% · ${free.toFixed(0)} GB free`,
      detail: projectDisk(samples) ?? "Trim backup retention before the next auto snapshot.",
      at: new Date(now).toISOString(),
      active: true,
    });
  }
  const fpsVals = recent.map((s) => s.fps).filter((n): n is number => n != null);
  if (fpsVals.length >= 3) {
    const fps = fpsVals.reduce((a, b) => a + b, 0) / fpsVals.length;
    if (fps < thresholds.fps) {
      alerts.push({
        id: "fps",
        kind: "fps",
        severity: fps < 12 ? "error" : "warn",
        title: `Sim FPS ${fps.toFixed(1)} from /v1/api/metrics`,
        detail: "Dedicated tick is slipping. Packed worlds should lower PalSpawnNumRate first.",
        at: new Date(now).toISOString(),
        active: true,
      });
    }
  }
  return alerts;
}

export function projectDisk(samples: MetricSample[]): string | null {
  const run = samples.filter((s) => s.running);
  if (run.length < 8) return null;
  const first = run[0]!;
  const last = run[run.length - 1]!;
  const dtH = (last.t - first.t) / 3_600_000;
  if (dtH < 0.2) return null;
  const usedDelta = last.diskUsedPct - first.diskUsedPct;
  if (usedDelta <= 0.05) return null;
  const hours = ((100 - last.diskUsedPct) / usedDelta) * dtH;
  if (!Number.isFinite(hours) || hours > 720) return null;
  return `At this rate the volume fills in about ${hours < 24 ? `${Math.max(1, Math.round(hours))}h` : `${Math.round(hours / 24)}d`}.`;
}

export function diskForecast(samples: MetricSample[]): DiskForecast {
  const last = samples[samples.length - 1];
  return {
    freeGb: last?.diskFreeGb ?? 0,
    usedPct: last?.diskUsedPct ?? 0,
    note: projectDisk(samples) ?? "Storage is not growing; no exhaustion projected from the current trend.",
  };
}

export function buildPulse(input: {
  running: boolean;
  startedAt: string | null;
  players: number;
  world?: WorldInfo;
  save?: WorldSaveData;
  backups: BackupInfo[];
  session: SessionStats;
  alerts: ResourceAlert[];
  restOn: boolean;
  now?: number;
}): WorldPulse {
  const now = input.now ?? Date.now();
  const parsed = parseWorldClock(input.save?.worldTime, input.world?.days ?? 0);
  const latestBackup = [...input.backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const saveAt = input.world?.lastPlayed || input.save?.imported?.at;
  let health: WorldPulse["health"] = input.running ? "running" : "stopped";
  if (input.running && input.alerts.some((a) => a.active && a.severity === "error")) health = "degraded";
  return {
    day: parsed.day,
    clock: parsed.clock,
    saveLabel: saveAt ? `Saved ${timeAgo(saveAt, now)}` : "No save evidence",
    backupLabel: latestBackup ? `Backup ${timeAgo(latestBackup.createdAt, now)}` : "No backup yet",
    uptime: formatUptime(input.startedAt, now),
    players: input.players,
    peakPlayers: Math.max(input.session.peakPlayers, input.players),
    joins: input.session.joins,
    leaves: input.session.leaves,
    unique: Math.max(input.session.unique, input.players),
    lastTransition: input.session.lastTransition,
    worldName: input.world?.name ?? "—",
    health,
    restOn: input.restOn,
  };
}

export function parseWorldClock(worldTime: string | undefined, daysFallback: number) {
  const m = worldTime?.match(/Day\s+(\d+)\s*[·•]\s*(\d{1,2}:\d{2})/i);
  if (m) return { day: Number(m[1]), clock: m[2]! };
  return { day: daysFallback, clock: "08:00" };
}

export function defaultSession(players: number, unique: number): SessionStats {
  return {
    peakPlayers: Math.max(players, 4),
    joins: Math.max(players + 2, 6),
    leaves: Math.max(unique - players, 2),
    unique: Math.max(unique, players),
    lastTransition: players ? "Mira joined" : null,
  };
}
