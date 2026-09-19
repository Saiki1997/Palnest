import type { LaunchArg, EngineTweak } from "./types.ts";
import { nid } from "./utils.ts";

export function defaultLaunchArgs(): LaunchArg[] {
  return [
    {
      id: "useperfthreads",
      flag: "-useperfthreads",
      value: "",
      enabled: true,
      note: "Dedicated-server thread pool. Keep on for 12+ players.",
      category: "threading",
      builtin: true,
    },
    {
      id: "noasync",
      flag: "-NoAsyncLoadingThread",
      value: "",
      enabled: true,
      note: "Stops a class of hitch on dedicated. Recommended by Pocketpair notes.",
      category: "threading",
      builtin: true,
    },
    {
      id: "mt",
      flag: "-UseMultithreadForDS",
      value: "",
      enabled: true,
      note: "Spreads AI and building sim across workers.",
      category: "threading",
      builtin: true,
    },
    {
      id: "workers",
      flag: "-NumberOfWorkerThreadsServer",
      value: "4",
      enabled: false,
      note: "Cap workers to physical cores minus two. 4 is a safe 8-core start.",
      category: "threading",
      builtin: true,
    },
    {
      id: "port",
      flag: "-port",
      value: "8211",
      enabled: true,
      note: "Listen port. Must match PalWorldSettings PublicPort.",
      category: "network",
      builtin: true,
    },
    {
      id: "queryport",
      flag: "-queryport",
      value: "27015",
      enabled: true,
      note: "Steam query. Forward UDP if the world should appear in the browser.",
      category: "network",
      builtin: true,
    },
    {
      id: "publicip",
      flag: "-publicip",
      value: "",
      enabled: false,
      note: "Public IP for the community list. Palnest fills this from playit.gg or PortWarp.",
      category: "network",
      builtin: true,
    },
    {
      id: "publicport",
      flag: "-publicport",
      value: "",
      enabled: false,
      note: "Public tunnel port. Must match the playit / PortWarp assignment, not the local UDP port.",
      category: "network",
      builtin: true,
    },
    {
      id: "players",
      flag: "-players",
      value: "32",
      enabled: true,
      note: "Hard cap. Keep in sync with ServerPlayerMaxNum.",
      category: "network",
      builtin: true,
    },
    {
      id: "publiclobby",
      flag: "-publiclobby",
      value: "",
      enabled: false,
      note: "Publish to the community list. Requires a public IP.",
      category: "community",
      builtin: true,
    },
    {
      id: "log",
      flag: "-log",
      value: "",
      enabled: true,
      note: "Writes PalServer logs Palnest tails on the Logs page.",
      category: "logging",
      builtin: true,
    },
    {
      id: "epic",
      flag: "EpicApp",
      value: "PalServer",
      enabled: true,
      note: "Required for Steam dedicated. Do not remove.",
      category: "community",
      builtin: true,
    },
  ];
}

export function defaultEngineTweaks(): EngineTweak[] {
  return [
    {
      id: "pool",
      section: "/Script/Engine.StreamingSettings",
      key: "s.AsyncLoadingThreadEnabled",
      value: "False",
      enabled: true,
      hint: "Mirrors -NoAsyncLoadingThread. Stops hitch spikes on dedicated PalServer.",
      target: "server",
      group: "streaming",
    },
    {
      id: "streamtime",
      section: "/Script/Engine.StreamingSettings",
      key: "s.AsyncLoadingTimeLimit",
      value: "4.0",
      enabled: true,
      hint: "Caps async load work per tick so the sim stays at 30 Hz under mod load.",
      target: "server",
      group: "streaming",
    },
    {
      id: "hitch",
      section: "/Script/Engine.StreamingSettings",
      key: "s.LevelStreamingActorsUpdateTimeLimit",
      value: "1.0",
      enabled: true,
      hint: "Spreads actor register across frames. Helps heavy-mod islands.",
      target: "server",
      group: "streaming",
    },
    {
      id: "unreg",
      section: "/Script/Engine.StreamingSettings",
      key: "s.UnregisterComponentsTimeLimit",
      value: "1.0",
      enabled: true,
      hint: "Same budget when unloading chunks. Cuts hitch on guild warps.",
      target: "server",
      group: "streaming",
    },
    {
      id: "gc",
      section: "/Script/Engine.GarbageCollectionSettings",
      key: "gc.MaxObjectsInGame",
      value: "2147483647",
      enabled: false,
      hint: "Raise on worlds with huge bases. Costs RAM. Heavy-world preset turns this on.",
      target: "server",
      group: "memory",
    },
    {
      id: "gctime",
      section: "/Script/Engine.GarbageCollectionSettings",
      key: "gc.TimeBetweenPurgingPendingKillObjects",
      value: "60",
      enabled: false,
      hint: "GC every 60s instead of constantly. Smooths 32-player tick, uses more RAM.",
      target: "server",
      group: "memory",
    },
    {
      id: "gcparallel",
      section: "/Script/Engine.GarbageCollectionSettings",
      key: "gc.AllowParallelGC",
      value: "True",
      enabled: true,
      hint: "Lets PalServer collect on worker threads. Keep on unless you debug crashes.",
      target: "server",
      group: "memory",
    },
    {
      id: "net",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "NetServerMaxTickRate",
      value: "30",
      enabled: true,
      hint: "30 is the usual dedicated tick. 60 burns CPU and does not make pals smarter.",
      target: "server",
      group: "tick",
    },
    {
      id: "lantick",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "LanServerMaxTickRate",
      value: "30",
      enabled: true,
      hint: "Match WAN tick so LAN and tunnel clients stay in lockstep.",
      target: "server",
      group: "tick",
    },
    {
      id: "tick",
      section: "/Script/Engine.Engine",
      key: "FixedFrameRate",
      value: "30.000000",
      enabled: false,
      hint: "Locks PalServer to 30 FPS. Helps overloaded hosts. Leave off if tick already holds.",
      target: "server",
      group: "tick",
    },
    {
      id: "smooth",
      section: "/Script/Engine.Engine",
      key: "bSmoothFrameRate",
      value: "False",
      enabled: true,
      hint: "Smoothing fights a dedicated sim. Keep off.",
      target: "server",
      group: "tick",
    },
    {
      id: "fixed",
      section: "/Script/Engine.Engine",
      key: "bUseFixedFrameRate",
      value: "False",
      enabled: true,
      hint: "Stay variable unless you enable the 30 FPS lock above.",
      target: "server",
      group: "tick",
    },
    {
      id: "bandwidth",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "MaxClientRate",
      value: "100000",
      enabled: true,
      hint: "Per-connection send cap. Raise with Network preset on 32-slot WAN.",
      target: "server",
      group: "network",
    },
    {
      id: "inet",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "MaxInternetClientRate",
      value: "100000",
      enabled: true,
      hint: "Internet clients (PortWarp / playit) need this or they starve vs LAN.",
      target: "server",
      group: "network",
    },
    {
      id: "keepalive",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "KeepAliveTime",
      value: "0.2",
      enabled: true,
      hint: "Faster keepalive so tunnel NAT mappings do not drop idle players.",
      target: "server",
      group: "network",
    },
    {
      id: "timeout",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "ConnectionTimeout",
      value: "300.0",
      enabled: true,
      hint: "300s timeout. Default is too tight for playit / PortWarp jitter.",
      target: "server",
      group: "network",
    },
    {
      id: "initial",
      section: "/Script/OnlineSubsystemUtils.IpNetDriver",
      key: "InitialConnectTimeout",
      value: "300.0",
      enabled: true,
      hint: "Lets a first join survive world load + tunnel handshake.",
      target: "server",
      group: "network",
    },
    {
      id: "netbw",
      section: "/Script/Engine.GameNetworkManager",
      key: "TotalNetBandwidth",
      value: "40000000",
      enabled: false,
      hint: "Host-wide send budget. Turn on with Network or Heavy world.",
      target: "server",
      group: "network",
    },
    {
      id: "maxdyn",
      section: "/Script/Engine.GameNetworkManager",
      key: "MaxDynamicBandwidth",
      value: "100000",
      enabled: true,
      hint: "Per-player ceiling. Keep aligned with MaxClientRate.",
      target: "server",
      group: "network",
    },
    {
      id: "mindyn",
      section: "/Script/Engine.GameNetworkManager",
      key: "MinDynamicBandwidth",
      value: "20000",
      enabled: true,
      hint: "Floor so a laggy client still gets movement updates.",
      target: "server",
      group: "network",
    },
    {
      id: "netspeed",
      section: "/Script/Engine.Player",
      key: "ConfiguredInternetSpeed",
      value: "100000",
      enabled: true,
      hint: "Client advertised speed. Matches the net driver caps.",
      target: "server",
      group: "network",
    },
    {
      id: "poolsize",
      section: "/Script/Engine.RendererSettings",
      key: "r.Streaming.PoolSize",
      value: "0",
      enabled: false,
      hint: "Dedicated PalServer has no GPU. Zero the texture pool to free RAM.",
      target: "server",
      group: "streaming",
    },
    {
      id: "oneFrame",
      section: "/Script/Engine.RendererSettings",
      key: "r.OneFrameThreadLag",
      value: "0",
      enabled: false,
      hint: "Drops a render-thread wait PalServer does not need. Heavy-world preset.",
      target: "server",
      group: "streaming",
    },
    {
      id: "vsync",
      section: "/Script/Engine.RendererSettings",
      key: "r.VSync",
      value: "0",
      enabled: true,
      hint: "VSync on a headless PalServer just stalls the game thread.",
      target: "server",
      group: "tick",
    },
    {
      id: "physics",
      section: "/Script/Engine.PhysicsSettings",
      key: "PhysXTreeRebuildRate",
      value: "10",
      enabled: false,
      hint: "Rebuilds the physics tree less often. Helps 32-base islands.",
      target: "server",
      group: "streaming",
    },
    {
      id: "scale",
      section: "ScalabilityGroups",
      key: "sg.ResolutionQuality",
      value: "0",
      enabled: false,
      hint: "Turns off dedicated render quality groups. Huge CPU save on PalServer.exe.",
      target: "server",
      group: "streaming",
      lines: [
        "sg.ResolutionQuality=0",
        "sg.ViewDistanceQuality=0",
        "sg.AntiAliasingQuality=0",
        "sg.ShadowQuality=0",
        "sg.PostProcessQuality=0",
        "sg.TextureQuality=0",
        "sg.EffectsQuality=0",
        "sg.FoliageQuality=0",
        "sg.ShadingQuality=0",
      ],
    },
    {
      id: "shader",
      section: "/Script/Engine.RendererSettings",
      key: "r.ShaderPipelineCache.Enabled",
      value: "1",
      enabled: true,
      hint: "Cuts hitch on first load of a new island. Safe on client and dedicated.",
      target: "both",
      group: "streaming",
    },
    {
      id: "far",
      section: "/Script/Engine.RendererSettings",
      key: "r.ViewDistanceScale",
      value: "0.8",
      enabled: false,
      hint: "Client visual only. Leave off the dedicated box.",
      target: "client",
      group: "visual",
    },
    {
      id: "foliage",
      section: "/Script/Engine.RendererSettings",
      key: "foliage.DensityScale",
      value: "0.7",
      enabled: false,
      hint: "Client foliage. Pairs with Lean World LODs.",
      target: "client",
      group: "visual",
    },
  ];
}

export function mergeEngineTweaks(existing: EngineTweak[] | undefined): EngineTweak[] {
  const map = new Map((existing ?? []).map((t) => [t.id, t]));
  return defaultEngineTweaks().map((def) => {
    const prev = map.get(def.id);
    if (!prev) return def;
    return {
      ...def,
      enabled: prev.enabled,
      value: prev.value || def.value,
    };
  });
}

export function tweaksToIni(tweaks: EngineTweak[], forTarget: EngineTweak["target"] = "server"): string {
  const sections = new Map<string, string[]>();
  for (const t of tweaks) {
    if (!t.enabled) continue;
    if (forTarget === "server" && t.target === "client") continue;
    if (forTarget === "client" && t.target === "server") continue;
    const list = sections.get(t.section) ?? [];
    if (t.lines?.length) list.push(...t.lines);
    else list.push(`${t.key}=${t.value}`);
    sections.set(t.section, list);
  }
  const parts = [
    "; Palworld Server & Mod Manager — Engine.ini",
    "; Restart PalServer.exe after changing these.",
    "",
  ];
  for (const [section, lines] of sections) {
    parts.push(`[${section}]`);
    parts.push(...lines);
    parts.push("");
  }
  return parts.join("\n");
}

export function groupedEngineTweaks(tweaks: EngineTweak[]): [string, EngineTweak[]][] {
  const labels: Record<NonNullable<EngineTweak["group"]>, string> = {
    tick: "Tick & frame",
    network: "Network",
    memory: "Memory & GC",
    streaming: "Streaming & CPU",
    visual: "Client visuals",
  };
  const order: NonNullable<EngineTweak["group"]>[] = ["tick", "network", "memory", "streaming", "visual"];
  const buckets = new Map<string, EngineTweak[]>();
  for (const t of tweaks) {
    const key = labels[t.group ?? "streaming"] ?? "Other";
    const list = buckets.get(key) ?? [];
    list.push(t);
    buckets.set(key, list);
  }
  const ordered: [string, EngineTweak[]][] = [];
  for (const g of order) {
    const label = labels[g];
    const list = buckets.get(label);
    if (list?.length) ordered.push([label, list]);
  }
  for (const [label, list] of buckets) {
    if (!ordered.some(([l]) => l === label)) ordered.push([label, list]);
  }
  return ordered;
}

export function renderCommandLine(exe: string, args: LaunchArg[]) {
  const parts = [quote(exe)];
  return [...parts, ...renderArgv(args)].join(" ");
}

export function renderArgv(args: LaunchArg[]) {
  const parts: string[] = [];
  for (const a of args) {
    if (!a.enabled) continue;
    if (a.flag.includes("=") || a.flag === "EpicApp") {
      parts.push(`${a.flag}=${a.value || "PalServer"}`);
      continue;
    }
    if (a.value) parts.push(`${a.flag}=${a.value}`);
    else parts.push(a.flag);
  }
  return parts;
}

function quote(s: string) {
  if (!s) return "PalServer.exe";
  return s.includes(" ") ? `"${s}"` : s;
}

export function addCustomArg(flag: string, value = ""): LaunchArg {
  return {
    id: nid("arg"),
    flag: flag.startsWith("-") || flag.includes("=") ? flag : `-${flag}`,
    value,
    enabled: true,
    note: "Custom flag.",
    category: "custom",
    builtin: false,
  };
}

export type OptimizePreset = {
  id: string;
  name: string;
  blurb: string;
  players: number;
  stackable?: boolean;
  args: Record<string, string | boolean>;
  settings: Record<string, string>;
  tweaks: Record<string, string | boolean>;
};

export const OPTIMIZE_PRESETS: OptimizePreset[] = [
  {
    id: "cozy",
    name: "Cozy",
    blurb: "Up to 8 friends. 1.0 rates, proximity voice, calmer nights.",
    players: 8,
    args: { useperfthreads: true, noasync: true, mt: true, workers: false, players: "8", publiclobby: false },
    settings: {
      ServerPlayerMaxNum: "8",
      ExpRate: "2.0",
      PalEggDefaultHatchingTime: "2",
      PalSpawnNumRate: "1.2",
      DeathPenalty: "None",
      bIsPvP: "False",
      bEnableVoiceChat: "True",
      CrossplayPlatforms: "Steam,Xbox,PS5,Mac",
    },
    tweaks: {},
  },
  {
    id: "community",
    name: "Community",
    blurb: "32 slots, vanilla 1.0 rates, public lobby, Steam/Xbox/PS5/Mac.",
    players: 32,
    args: { useperfthreads: true, noasync: true, mt: true, workers: true, players: "32", publiclobby: true },
    settings: {
      ServerPlayerMaxNum: "32",
      ExpRate: "1.0",
      PalEggDefaultHatchingTime: "24",
      PalSpawnNumRate: "1.0",
      DeathPenalty: "Item",
      bIsPvP: "False",
      bEnableVoiceChat: "True",
      CrossplayPlatforms: "Steam,Xbox,PS5,Mac",
    },
    tweaks: { net: "30", bandwidth: "100000", inet: "100000", keepalive: true },
  },
  {
    id: "packed",
    name: "Packed",
    blurb: "32 on the doubled 1.0 map. Spawn and foliage dialed down.",
    players: 32,
    args: { useperfthreads: true, noasync: true, mt: true, workers: true, players: "32", publiclobby: true },
    settings: {
      ServerPlayerMaxNum: "32",
      PalSpawnNumRate: "0.7",
      CollectionDropRate: "0.8",
    },
    tweaks: { net: "30", streamtime: true, hitch: true },
  },
  {
    id: "heavy",
    name: "Heavy world",
    blurb: "Lots of bases and 32 players. More workers, lower spawn, 30-tick sim, GC and render pool off.",
    players: 32,
    args: { useperfthreads: true, noasync: true, mt: true, workers: "8", players: "32", publiclobby: true },
    settings: {
      ServerPlayerMaxNum: "32",
      PalSpawnNumRate: "0.55",
      CollectionDropRate: "0.7",
      bEnableInvaderEnemy: "False",
    },
    tweaks: {
      net: "30",
      bandwidth: "80000",
      inet: "80000",
      gc: true,
      gctime: "60",
      gcparallel: true,
      poolsize: true,
      oneFrame: true,
      physics: true,
      scale: true,
      tick: "30.000000",
      fixed: "True",
      streamtime: true,
      hitch: true,
    },
  },
  {
    id: "heavymod",
    name: "Heavy mods",
    blurb: "Big UE4SS + PalSchema stacks. Keep async off, do not oversubscribe workers, cap streaming.",
    players: 24,
    args: { useperfthreads: true, noasync: true, mt: true, workers: "4", players: "24", publiclobby: false, log: true },
    settings: {
      ServerPlayerMaxNum: "24",
      PalSpawnNumRate: "0.7",
    },
    tweaks: { pool: true, net: "30", shader: true, streamtime: true, hitch: true, unreg: true, gcparallel: true, scale: true },
  },
  {
    id: "network",
    name: "Network",
    blurb: "Stacks with the other presets. Send-rate, keepalive, and timeouts tuned for WAN, PortWarp, and playit.",
    players: 32,
    stackable: true,
    args: { publiclobby: true },
    settings: {},
    tweaks: {
      net: "30",
      bandwidth: "100000",
      inet: "100000",
      keepalive: true,
      timeout: "300.0",
      initial: "300.0",
      netbw: true,
      maxdyn: "100000",
      mindyn: "20000",
      netspeed: "100000",
    },
  },
  {
    id: "perf",
    name: "Server performance",
    blurb: "Stacks. Writes the Engine.ini pack PalServer needs: 30-tick, parallel GC, tight streaming, no VSync.",
    players: 32,
    stackable: true,
    args: { useperfthreads: true, noasync: true, mt: true },
    settings: {},
    tweaks: {
      pool: true,
      streamtime: true,
      hitch: true,
      unreg: true,
      gcparallel: true,
      net: "30",
      lantick: "30",
      tick: "30.000000",
      fixed: "True",
      smooth: true,
      vsync: true,
      bandwidth: "100000",
      inet: "100000",
      keepalive: true,
      timeout: "300.0",
      initial: "300.0",
      netbw: true,
      maxdyn: true,
      mindyn: true,
      netspeed: true,
      shader: true,
      scale: true,
      poolsize: true,
      oneFrame: true,
      physics: true,
      gc: true,
      gctime: "60",
    },
  },
];
