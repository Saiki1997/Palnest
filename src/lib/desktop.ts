import type { ScanFile } from "./scan";
import type { AgentScan } from "./agents";

export type HostListen = { bound: boolean; transport: "udp" | "tcp" | "none"; simulated?: boolean };
export type HostMetrics = { cpu: number; ramMb: number; running: boolean };
export type HostWrite = { ok: boolean; simulated?: boolean; error?: string; path?: string };
export type HostSpawn = { ok: boolean; pid?: number; simulated?: boolean; error?: string };

export type PalnestDesktopApi = {
  isDesktop: true;
  pickFolder: () => Promise<string | null>;
  openPath: (target: string) => Promise<boolean>;
  version: () => Promise<string>;
  scanInstall?: (root: string) => Promise<ScanFile[]>;
  detectSteam?: () => Promise<{ steam?: string; client?: string; server?: string }>;
  detectAgents?: () => Promise<AgentScan>;
  writeFile?: (path: string, contents: string | ArrayBuffer) => Promise<HostWrite>;
  spawnPal?: (id: string, exe: string, argv: string[], cwd: string) => Promise<HostSpawn>;
  stopPal?: (id: string) => Promise<boolean>;
  palMetrics?: (id: string) => Promise<HostMetrics>;
  steamcmd?: (argv: string[], cwd?: string) => Promise<HostWrite>;
  extractZip?: (zip: string, dest: string) => Promise<HostWrite>;
  zipDir?: (src: string, dest: string) => Promise<HostWrite>;
  restoreZip?: (zip: string, dest: string) => Promise<HostWrite>;
  enableMod?: (path: string, kind: string, on: boolean) => Promise<HostWrite>;
  rest?: (url: string, method: string, body?: unknown, user?: string, pass?: string) => Promise<{ ok: boolean; status: number; body?: unknown; error?: string }>;
  upnp?: (port: number, on: boolean) => Promise<HostWrite>;
  spawnAgent?: (kind: "playit" | "portwarp", argv: string[], cwd?: string) => Promise<HostSpawn>;
  stopAgent?: (kind: "playit" | "portwarp") => Promise<boolean>;
  launchGame?: (exe: string, connect?: string) => Promise<HostSpawn>;
  autostart?: (on: boolean) => Promise<boolean>;
  setTray?: (on: boolean) => Promise<boolean>;
  notify?: (title: string, body: string) => Promise<boolean>;
  udpListen?: (port: number) => Promise<HostListen>;
  onConsole?: (fn: (ev: { id: string; stream: "out" | "err"; text: string }) => void) => () => void;
  onDeepLink?: (fn: (url: string) => void) => () => void;
};

declare global {
  interface Window {
    palnestDesktop?: PalnestDesktopApi;
  }
}

export function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.palnestDesktop?.isDesktop);
}

export async function pickFolder(): Promise<string | null> {
  if (!window.palnestDesktop) return null;
  return window.palnestDesktop.pickFolder();
}

export async function scanInstall(root: string): Promise<ScanFile[]> {
  if (!window.palnestDesktop?.scanInstall) return [];
  return window.palnestDesktop.scanInstall(root);
}

export async function revealPath(target: string) {
  if (!window.palnestDesktop || !target) return false;
  return window.palnestDesktop.openPath(target);
}

export const WINDOWS_APP_HREF = "/downloads/palnest-windows";
export const WINDOWS_SETUP_HREF = "/downloads/palnest-setup";
