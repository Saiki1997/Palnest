import type { ServerState, TunnelEndpoint, TunnelProvider, TunnelState, TunnelStatus } from "./types.ts";

export const PLAYIT_AGENT = "0.17.1";
export const PORTWARP_AGENT = "1.4.0";

export const TUNNEL_PROVIDERS: {
  id: TunnelProvider;
  name: string;
  blurb: string;
  url: string;
  download: string;
  protocol: string;
  claim: boolean;
  extraQuery: boolean;
}[] = [
  {
    id: "playit",
    name: "playit.gg",
    blurb: "Palworld-typed UDP tunnel. Claim the agent, then Palnest writes -publicip and -publicport so the community list works.",
    url: "https://playit.gg",
    download: "https://playit.gg/download",
    protocol: "UDP · Palworld preset",
    claim: true,
    extraQuery: false,
  },
  {
    id: "portwarp",
    name: "PortWarp",
    blurb: "Native UDP plus a Steam query extra port — but only after PalServer actually binds. Older builds listen after world load; Palnest waits so PortWarp does not miss them.",
    url: "https://portwarp.com",
    download: "https://portwarp.com/download",
    protocol: "UDP + query extra",
    claim: false,
    extraQuery: true,
  },
];

export function idleTunnel(localPort = 8211, provider: TunnelProvider = "none"): TunnelState {
  return {
    provider,
    status: "idle",
    agentInstalled: false,
    claimUrl: "",
    claimCode: "",
    tunnelId: "",
    region: provider === "playit" ? "global-anycast" : provider === "portwarp" ? "anycast" : "",
    localPort,
    game: null,
    query: null,
    lastError: "",
    startedAt: null,
    agentVersion: "",
  };
}

export function slugHost(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug || "palnest";
}

function playitEndpoint(name: string, slot: number, localPort: number): { game: TunnelEndpoint; query: TunnelEndpoint } {
  const slug = slugHost(name);
  const publicPort = 30051 + slot * 17;
  const ip = `147.185.221.${40 + (slot % 200)}`;
  const host = `${slug}.gl.at.ply.gg`;
  return {
    game: { host, port: publicPort, ip },
    query: { host, port: publicPort + 1, ip },
  };
}

function portwarpEndpoint(name: string, slot: number, localPort: number, queryPort: number): {
  game: TunnelEndpoint;
  query: TunnelEndpoint;
} {
  const slug = slugHost(name);
  const host = `${slug}.join.portwarp.app`;
  const ip = `198.51.100.${20 + (slot % 200)}`;
  return {
    game: { host, port: localPort, ip },
    query: { host, port: queryPort, ip },
  };
}

export function allocateTunnel(instance: Pick<ServerState, "name" | "slot" | "port" | "queryPort">, provider: TunnelProvider) {
  if (provider === "playit") return playitEndpoint(instance.name, instance.slot, instance.port);
  if (provider === "portwarp") return portwarpEndpoint(instance.name, instance.slot, instance.port, instance.queryPort);
  return { game: null as TunnelEndpoint | null, query: null as TunnelEndpoint | null };
}

function claimCode(slot: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  let n = 0x9e3779b9 ^ (slot + 1) * 2654435761;
  for (let i = 0; i < 6; i++) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    out += alphabet[n % alphabet.length];
  }
  return out;
}

export type TunnelAction = "install" | "claim" | "confirm" | "create" | "start" | "stop" | "reset";

export function advanceTunnel(
  tunnel: TunnelState,
  action: TunnelAction,
  ctx: { name: string; slot: number; port: number; queryPort: number; provider?: TunnelProvider },
): TunnelState {
  const provider = ctx.provider ?? tunnel.provider;
  if (provider === "none" && action !== "reset") {
    return { ...tunnel, lastError: "Pick playit.gg or PortWarp first.", status: "error" };
  }

  if (action === "reset") {
    return idleTunnel(ctx.port, provider);
  }

  if (action === "install") {
    const playit = provider === "playit";
    const code = playit ? claimCode(ctx.slot) : "";
    return {
      ...idleTunnel(ctx.port, provider),
      provider,
      status: playit ? "claim" : "offline",
      agentInstalled: true,
      agentVersion: playit ? PLAYIT_AGENT : PORTWARP_AGENT,
      region: playit ? "global-anycast" : "anycast",
      claimCode: code,
      claimUrl: playit ? `https://playit.gg/claim/${code}` : "",
      lastError: "",
    };
  }

  if (action === "claim") {
    const code = claimCode(ctx.slot);
    return {
      ...tunnel,
      provider,
      status: "claim",
      agentInstalled: true,
      agentVersion: tunnel.agentVersion || (provider === "playit" ? PLAYIT_AGENT : PORTWARP_AGENT),
      claimCode: code,
      claimUrl: `https://playit.gg/claim/${code}`,
      lastError: "",
    };
  }

  if (action === "confirm") {
    return { ...tunnel, provider, status: "offline", lastError: "", claimUrl: tunnel.claimUrl, claimCode: tunnel.claimCode };
  }

  if (action === "create") {
    const allocated = allocateTunnel({ name: ctx.name, slot: ctx.slot, port: ctx.port, queryPort: ctx.queryPort }, provider);
    return {
      ...tunnel,
      provider,
      status: "offline",
      agentInstalled: true,
      agentVersion: tunnel.agentVersion || (provider === "playit" ? PLAYIT_AGENT : PORTWARP_AGENT),
      tunnelId: `${provider}-${slugHost(ctx.name)}-${ctx.slot}`,
      localPort: ctx.port,
      game: allocated.game,
      query: provider === "portwarp" ? allocated.query : null,
      lastError: "",
    };
  }

  if (action === "start") {
    if (!tunnel.agentInstalled) {
      return { ...tunnel, status: "error", lastError: "Install the tunnel agent first." };
    }
    if (provider === "playit" && tunnel.status === "claim") {
      return { ...tunnel, status: "error", lastError: "Claim the playit agent, then create the Palworld tunnel." };
    }
    let next = tunnel;
    if (!tunnel.game) {
      next = advanceTunnel(tunnel, "create", { ...ctx, provider });
    }
    if (!next.game) {
      return { ...next, status: "error", lastError: "Tunnel has no public address yet." };
    }
    return {
      ...next,
      provider,
      status: "online",
      startedAt: new Date().toISOString(),
      lastError: "",
    };
  }

  if (action === "stop") {
    return {
      ...tunnel,
      status: tunnel.game ? "offline" : "idle",
      startedAt: null,
      lastError: "",
    };
  }

  return tunnel;
}

export function joinIp(instance: Pick<ServerState, "port" | "publicIp" | "tunnel">) {
  if (instance.tunnel.status === "online" && instance.tunnel.game) {
    return `${instance.tunnel.game.ip}:${instance.tunnel.game.port}`;
  }
  if (instance.publicIp) return `${instance.publicIp}:${instance.port}`;
  return `127.0.0.1:${instance.port}`;
}

export function joinHost(instance: Pick<ServerState, "port" | "publicIp" | "tunnel">) {
  if (instance.tunnel.status === "online" && instance.tunnel.game) {
    return `${instance.tunnel.game.host}:${instance.tunnel.game.port}`;
  }
  return joinIp(instance);
}

export function tunnelLaunchFlags(tunnel: TunnelState): { publicIp: string; publicPort: number | null } {
  if (tunnel.status === "online" && tunnel.game) {
    return { publicIp: tunnel.game.ip, publicPort: tunnel.game.port };
  }
  return { publicIp: "", publicPort: null };
}

export function tunnelLabel(status: TunnelStatus) {
  if (status === "online") return "Online";
  if (status === "claim") return "Claim agent";
  if (status === "installing") return "Installing";
  if (status === "connecting") return "Connecting";
  if (status === "offline") return "Agent ready";
  if (status === "error") return "Error";
  return "Off";
}

export function providerMeta(id: TunnelProvider) {
  return TUNNEL_PROVIDERS.find((p) => p.id === id);
}
