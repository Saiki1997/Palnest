export type AgentKind = "playit" | "portwarp";

export interface AgentHit {
  kind: AgentKind;
  name: string;
  installed: boolean;
  running: boolean;
  path: string;
  note: string;
  simulated?: boolean;
}

export interface AgentScan {
  playit: AgentHit;
  portwarp: AgentHit;
  scannedAt: string;
  simulated: boolean;
}

export const AGENT_NAMES: Record<AgentKind, string> = {
  playit: "playit.gg",
  portwarp: "PortWarp",
};

const PLAYIT_HINTS = ["playit.exe", "playit", "playit_gg"];
const PORTWARP_HINTS = ["pwrp.exe", "portwarp.exe", "pwrp", "portwarp"];

export function emptyAgent(kind: AgentKind, simulated = true): AgentHit {
  return {
    kind,
    name: AGENT_NAMES[kind],
    installed: false,
    running: false,
    path: "",
    note: simulated
      ? `This preview cannot see your PC. Palnest.exe scans for ${AGENT_NAMES[kind]}.`
      : `${AGENT_NAMES[kind]} was not found.`,
    simulated,
  };
}

export function emptyAgentScan(simulated = true): AgentScan {
  return {
    playit: emptyAgent("playit", simulated),
    portwarp: emptyAgent("portwarp", simulated),
    scannedAt: new Date().toISOString(),
    simulated,
  };
}

export function parseAgentProbe(input: {
  playit?: Partial<AgentHit> | null;
  portwarp?: Partial<AgentHit> | null;
  simulated?: boolean;
}): AgentScan {
  const simulated = Boolean(input.simulated);
  const playit = mergeHit("playit", input.playit, simulated);
  const portwarp = mergeHit("portwarp", input.portwarp, simulated);
  return { playit, portwarp, scannedAt: new Date().toISOString(), simulated };
}

function mergeHit(kind: AgentKind, raw: Partial<AgentHit> | null | undefined, simulated: boolean): AgentHit {
  const base = emptyAgent(kind, simulated);
  if (!raw) return base;
  const installed = Boolean(raw.installed || raw.running || raw.path);
  const running = Boolean(raw.running);
  const path = String(raw.path || "");
  let note = raw.note || "";
  if (!note) {
    if (running) note = `${AGENT_NAMES[kind]} is running${path ? ` (${path})` : ""}. Palnest can attach without installing another copy.`;
    else if (installed) note = `${AGENT_NAMES[kind]} is installed${path ? ` at ${path}` : ""}. Start it from Tunnels after PalServer binds UDP.`;
    else note = base.note;
  }
  return { ...base, ...raw, kind, name: AGENT_NAMES[kind], installed, running, path, note, simulated };
}

export function looksLikeAgentPath(kind: AgentKind, path: string) {
  const n = path.toLowerCase();
  const hints = kind === "playit" ? PLAYIT_HINTS : PORTWARP_HINTS;
  return hints.some((h) => n.includes(h.replace(".exe", "")));
}

export function preferredAgent(scan: AgentScan): AgentKind | "none" {
  if (scan.portwarp.running || scan.portwarp.installed) return "portwarp";
  if (scan.playit.running || scan.playit.installed) return "playit";
  return "none";
}
