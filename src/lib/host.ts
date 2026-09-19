import { emptyAgentScan, parseAgentProbe, type AgentScan } from "./agents";
import { isDesktopApp } from "./desktop";
import type { HostMetrics, HostSpawn, HostWrite } from "./desktop";

function desktop() {
  return typeof window !== "undefined" ? window.palnestDesktop : undefined;
}

export function hostKind(): "desktop" | "web" {
  return isDesktopApp() ? "desktop" : "web";
}

export async function hostDetectSteam() {
  const api = desktop();
  if (api?.detectSteam) return api.detectSteam();
  return {
    steam: "C:\\Program Files (x86)\\Steam",
    client: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Palworld",
    server: "C:\\Program Files (x86)\\Steam\\steamapps\\common\\PalServer",
    simulated: true as const,
  };
}

export async function hostDetectAgents(): Promise<AgentScan> {
  const api = desktop();
  if (api?.detectAgents) {
    const raw = await api.detectAgents();
    return parseAgentProbe(raw);
  }
  return emptyAgentScan(true);
}

export async function hostWriteFile(path: string, contents: string | Uint8Array): Promise<HostWrite> {
  const api = desktop();
  if (api?.writeFile) {
    const payload = typeof contents === "string" ? contents : contents.buffer.slice(contents.byteOffset, contents.byteOffset + contents.byteLength);
    return api.writeFile(path, payload as string | ArrayBuffer);
  }
  return { ok: true, simulated: true, path };
}

export async function hostSpawnPal(id: string, exe: string, argv: string[], cwd: string): Promise<HostSpawn> {
  const api = desktop();
  if (api?.spawnPal) return api.spawnPal(id, exe, argv, cwd);
  return { ok: true, pid: 40000 + Math.floor(Math.random() * 9999), simulated: true };
}

export async function hostStopPal(id: string) {
  const api = desktop();
  if (api?.stopPal) return api.stopPal(id);
  return true;
}

export async function hostMetrics(id: string): Promise<HostMetrics> {
  const api = desktop();
  if (api?.palMetrics) return api.palMetrics(id);
  return { cpu: 0, ramMb: 0, running: false };
}

export async function hostSteamcmd(argv: string[], cwd?: string): Promise<HostWrite> {
  const api = desktop();
  if (api?.steamcmd) return api.steamcmd(argv, cwd);
  return { ok: true, simulated: true };
}

export async function hostZipDir(src: string, dest: string): Promise<HostWrite> {
  const api = desktop();
  if (api?.zipDir) return api.zipDir(src, dest);
  return { ok: true, simulated: true, path: dest };
}

export async function hostRestoreZip(zip: string, dest: string): Promise<HostWrite> {
  const api = desktop();
  if (api?.restoreZip) return api.restoreZip(zip, dest);
  return { ok: true, simulated: true, path: dest };
}

export async function hostExtractZip(zip: string, dest: string): Promise<HostWrite> {
  const api = desktop();
  if (api?.extractZip) return api.extractZip(zip, dest);
  return { ok: true, simulated: true, path: dest };
}

export async function hostEnableMod(path: string, kind: string, on: boolean): Promise<HostWrite> {
  const api = desktop();
  if (api?.enableMod) return api.enableMod(path, kind, on);
  return { ok: true, simulated: true, path };
}

export async function hostRest(url: string, method: string, body?: unknown, user?: string, pass?: string) {
  const api = desktop();
  if (api?.rest) return api.rest(url, method, body, user, pass);
  return { ok: true, status: 200, body: { simulated: true } };
}

export async function hostUpnp(port: number, on: boolean): Promise<HostWrite> {
  const api = desktop();
  if (api?.upnp) return api.upnp(port, on);
  return { ok: true, simulated: true };
}

export type HostListen = { bound: boolean; transport: "udp" | "tcp" | "none"; simulated?: boolean };

export async function hostUdpListen(port: number): Promise<HostListen> {
  const api = desktop();
  if (api?.udpListen) return api.udpListen(port);
  return { bound: false, transport: "none", simulated: true };
}

export async function hostSpawnAgent(kind: "playit" | "portwarp", argv: string[], cwd?: string): Promise<HostSpawn> {
  const api = desktop();
  if (api?.spawnAgent) return api.spawnAgent(kind, argv, cwd);
  return { ok: true, pid: 50000, simulated: true };
}

export async function hostStopAgent(kind: "playit" | "portwarp") {
  const api = desktop();
  if (api?.stopAgent) return api.stopAgent(kind);
  return true;
}

export async function hostLaunchGame(exe: string, connect?: string): Promise<HostSpawn> {
  const api = desktop();
  if (api?.launchGame) return api.launchGame(exe, connect);
  return { ok: true, simulated: true };
}

export async function hostAutostart(on: boolean) {
  const api = desktop();
  if (api?.autostart) return api.autostart(on);
  return false;
}

export async function hostSetTray(on: boolean) {
  const api = desktop();
  if (api?.setTray) return api.setTray(on);
  return on;
}

export async function hostNotify(title: string, body: string) {
  const api = desktop();
  if (api?.notify) return api.notify(title, body);
  return false;
}

export async function postWebhook(url: string, payload: unknown) {
  if (!url.trim()) return { ok: false as const, skipped: true };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false as const };
  }
}
