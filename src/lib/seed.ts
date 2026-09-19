import { CATALOG, CURRENT_GAME } from "./catalog";
import { defaultLaunchArgs, defaultEngineTweaks } from "./args";
import { defaultSettings } from "./ini";
import { defaultSession, emptyMonitor, seedHistory, type MonitorState } from "./monitor";
import { modInstallPath } from "./paths";
import { defaultOps, type BanEntry, type ModProfile, type OpsState } from "./ops";
import { normalizeInstance, portsForSlot } from "./fleet";
import { idleTunnel } from "./tunnels";
import type {
  AppMode,
  BackupInfo,
  FrameworkInstall,
  InstalledMod,
  KeysState,
  LogEntry,
  PathsState,
  ServerState,
  WorldInfo,
  WorldSaveData,
} from "./types";

export { APP_VERSION, APP_BUILD, APP_NAME, APP_EDITION, APP_LINE } from "./version";
export const APP_TAGLINE = "Palworld Server & Mod Manager";

export interface PalnestState {
  onboarded: boolean;
  mode: AppMode;
  paths: PathsState;
  keys: KeysState;
  autoBackup: boolean;
  crashWatchdog: boolean;
  captureConsole: boolean;
  checkModUpdates: boolean;
  guideDismissed: boolean;
  checkerRan: boolean;
  server: ServerState;
  instances: ServerState[];
  activeServerId: string;
  worlds: WorldInfo[];
  backups: BackupInfo[];
  mods: InstalledMod[];
  frameworks: Record<string, FrameworkInstall>;
  launchArgs: ReturnType<typeof defaultLaunchArgs>;
  worldSettings: ReturnType<typeof defaultSettings>;
  worldSaves: Record<string, WorldSaveData>;
  engineTweaks: ReturnType<typeof defaultEngineTweaks>;
  logs: LogEntry[];
  monitor: MonitorState;
  ops: OpsState;
  profiles: ModProfile[];
  bans: BanEntry[];
  allow: string[];
  consoleLines: Record<string, { id: string; ts: string; stream: "out" | "err"; text: string }[]>;
  denSettings: Record<string, ReturnType<typeof defaultSettings>>;
  lastBackupAt: string | null;
  lastRestartDay: string;
}

const SAMPLE_CLIENT = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Palworld";
const SAMPLE_SERVER = "C:\\PalServers\\HollowIsle";

function frameworksEmpty(): Record<string, FrameworkInstall> {
  return {
    ue4ss: {
      id: "ue4ss",
      name: "UE4SS",
      clientVersion: null,
      serverVersion: null,
      latestKnown: null,
      assetName: null,
      updatedAt: null,
    },
    palschema: {
      id: "palschema",
      name: "PalSchema",
      clientVersion: null,
      serverVersion: null,
      latestKnown: null,
      assetName: null,
      updatedAt: null,
      },
    reshade: {
      id: "reshade",
      name: "ReShade",
      clientVersion: null,
      serverVersion: null,
      latestKnown: "6.5.1",
      assetName: null,
      updatedAt: null,
    },
    optiscaler: {
      id: "optiscaler",
      name: "OptiScaler",
      clientVersion: null,
      serverVersion: null,
      latestKnown: "0.7.9",
      assetName: null,
      updatedAt: null,
    },
  };
}

export function emptyState(): PalnestState {
  return {
    onboarded: false,
    mode: "both",
    paths: { client: "", server: "" },
    keys: { nexus: "", curseforge: "", steam: "" },
    autoBackup: true,
    crashWatchdog: true,
    captureConsole: true,
    checkModUpdates: true,
    guideDismissed: false,
    checkerRan: false,
    server: blankServer(),
    instances: [blankServer()],
    activeServerId: "srv-primary",
    worlds: [],
    backups: [],
    mods: [],
    frameworks: frameworksEmpty(),
    launchArgs: defaultLaunchArgs(),
    worldSettings: defaultSettings(),
    worldSaves: {},
    engineTweaks: defaultEngineTweaks(),
    logs: [],
    monitor: emptyMonitor(),
    ops: defaultOps(),
    profiles: [],
    bans: [],
    allow: [],
    consoleLines: {},
    denSettings: {},
    lastBackupAt: null,
    lastRestartDay: "",
  };
}

function blankServer(): ServerState {
  const ports = portsForSlot(0);
  return normalizeInstance({
    id: "srv-primary",
    name: "Palnest World",
    description: "A well-kept island.",
    running: false,
    startedAt: null,
    version: CURRENT_GAME,
    build: "1120515",
    ...ports,
    maxPlayers: 32,
    community: false,
    publicIp: "",
    players: [],
    versions: SERVER_VERSIONS,
    history: [CURRENT_GAME],
    imported: false,
    importedFrom: "",
    installPath: "",
    worldId: "",
    slot: 0,
    notes: "",
    tunnel: idleTunnel(ports.port),
  });
}

export const SERVER_VERSIONS = [
  {
    id: "105",
    version: "1.0.5",
    channel: "stable" as const,
    releasedAt: "2026-09-15T00:00:00.000Z",
    notes: "Current. Bug fixes for terrain textures and map-icon filters. PalSchema 0.6.71 + UE4SS 2281fa31.",
  },
  {
    id: "104",
    version: "1.0.4",
    channel: "stable" as const,
    releasedAt: "2026-09-01T00:00:00.000Z",
    notes: "1.0 patch line. No DataTable row-struct changes. Safe rollback from 1.0.5.",
  },
  {
    id: "102",
    version: "1.0.2",
    channel: "stable" as const,
    releasedAt: "2026-08-12T00:00:00.000Z",
    notes: "Mod-support improvement (1.0.2.100993). PalSchema packs targeting 1.0 still load.",
  },
  {
    id: "100",
    version: "1.0.0",
    channel: "stable" as const,
    releasedAt: "2026-07-10T00:00:00.000Z",
    notes: "Full release. World Tree, Sky Islands, proximity voice, level cap 80. Delete Early Access mods before this hop.",
  },
  {
    id: "073",
    version: "0.7.3",
    channel: "experimental" as const,
    releasedAt: "2026-07-02T00:00:00.000Z",
    notes: "Last Early Access build. Rollback only. 0.7 UE4SS and PalSchema will not boot Palworld 1.0.",
  },
];

function pick(id: string) {
  const c = CATALOG.find((m) => m.id === id);
  if (!c) throw new Error(id);
  return c;
}

function installFromCatalog(
  catalogId: string,
  extra: Partial<InstalledMod> & { target: InstalledMod["target"]; enabled: boolean; loadOrder: number },
): InstalledMod {
  const c = pick(catalogId);
  const roots = { client: SAMPLE_CLIENT, server: SAMPLE_SERVER };
  return {
    id: `mod-${catalogId}`,
    catalogId: c.id,
    name: c.name,
    author: c.author,
    version: extra.version ?? c.version,
    latestVersion: c.version,
    kind: c.kind === "framework" ? "palschema" : c.kind,
    source: c.source,
    sourceId: c.sourceId,
    target: extra.target,
    enabled: extra.enabled,
    loadOrder: extra.loadOrder,
    gameVersions: c.gameVersions,
    requires: c.requires.filter((r) => r !== "palschema" || c.kind !== "framework"),
    serverCompatible: c.serverCompatible,
    clientCompatible: c.clientCompatible,
    description: c.description,
    category: c.category,
    installPath: extra.installPath ?? modInstallPath(c.kind === "framework" ? "palschema" : c.kind, c.name, extra.target, roots),
    fileCount: extra.fileCount ?? 4,
    sizeKb: c.sizeKb,
    installedAt: extra.installedAt ?? "2026-08-20T12:00:00.000Z",
    updatedAt: extra.updatedAt ?? c.updatedAt,
    broken: extra.broken,
    notes: extra.notes,
  };
}

export function sampleState(): PalnestState {
  const startedAt = new Date(Date.now() - 1000 * 60 * 214).toISOString();
  const mods: InstalledMod[] = [
    installFromCatalog("nx-betterpalbox", { target: "both", enabled: true, loadOrder: 10 }),
    installFromCatalog("nx-stack", { target: "both", enabled: true, loadOrder: 20 }),
    installFromCatalog("nx-basecap", { target: "server", enabled: true, loadOrder: 30 }),
    installFromCatalog("nx-nodurability", {
      target: "both",
      enabled: true,
      loadOrder: 40,
      version: "1.4.2",
    }),
    installFromCatalog("nx-deathchest", { target: "server", enabled: true, loadOrder: 50 }),
    installFromCatalog("st-admin", { target: "server", enabled: true, loadOrder: 60 }),
    installFromCatalog("cf-recipebook", { target: "both", enabled: true, loadOrder: 70 }),
    installFromCatalog("cf-oreveins", { target: "server", enabled: true, loadOrder: 80 }),
    installFromCatalog("cf-terraria-pals", { target: "both", enabled: true, loadOrder: 90 }),
    installFromCatalog("nx-palanalyzer", { target: "client", enabled: true, loadOrder: 15 }),
    installFromCatalog("nx-mapunlock", { target: "client", enabled: true, loadOrder: 25 }),
    installFromCatalog("nx-rescue", { target: "client", enabled: true, loadOrder: 35 }),
    installFromCatalog("st-restskin", { target: "client", enabled: true, loadOrder: 45 }),
    installFromCatalog("nx-brokenlegacy", {
      target: "client",
      enabled: true,
      loadOrder: 99,
      broken: true,
      fileCount: 0,
      notes: "Scripts/main.lua missing after Palworld 1.0.",
    }),
  ];

  const logs: LogEntry[] = [
    {
      id: "l1",
      ts: new Date(Date.now() - 1000 * 60 * 214).toISOString(),
      level: "ok",
      source: "server",
      message: "PalServer 1.0.5 (1120515) listening on UDP 8211.",
    },
    {
      id: "l2",
      ts: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
      level: "ok",
      source: "ue4ss",
      message: "UE4SS 2281fa31 attached. 8 Lua mods, 6 PalSchema packs.",
    },
    {
      id: "l3",
      ts: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      level: "warn",
      source: "checker",
      message: "Broken pack Tidebound is client-side. Checker lists it; PalServer start ignores client-only packs.",
    },
    {
      id: "l4",
      ts: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      level: "info",
      source: "rest",
      message: "Mira joined Hollow Isle (12/32).",
    },
    {
      id: "l6",
      ts: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      level: "ok",
      source: "playit",
      message: "playit.gg Palworld tunnel online · 147.185.221.40:30051 (hollow-isle.gl.at.ply.gg).",
    },
    {
      id: "l7",
      ts: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
      level: "info",
      source: "fleet",
      message: "Build Yard is idle on UDP 8221. Start it alongside Hollow Isle when the yard needs players.",
    },
  ];

  const hollowPlayers = [
    { name: "Mira", playerId: "76561198000001", level: 72, ping: 28, location: "World Tree", guild: "Shoal", online: true },
    { name: "Ren", playerId: "76561198000002", level: 54, ping: 61, location: "Sunreach", guild: "Shoal", online: true },
    { name: "Ivy", playerId: "76561198000003", level: 68, ping: 19, location: "Sky Islands", guild: "Ashwalkers", online: true },
    { name: "Kade", playerId: "76561198000004", level: 22, ping: 110, location: "Plateau of Beginnings", guild: "—", online: true },
  ];
  const hollow = normalizeInstance({
    id: "srv-hollow",
    name: "Hollow Isle",
    description: "A quiet community world. No griders.",
    running: true,
    startedAt,
    version: CURRENT_GAME,
    build: "1120515",
    ...portsForSlot(0),
    maxPlayers: 32,
    community: true,
    publicIp: "147.185.221.40",
    players: hollowPlayers,
    versions: SERVER_VERSIONS,
    history: ["1.0.0", "1.0.2", CURRENT_GAME],
    imported: true,
    importedFrom: SAMPLE_SERVER,
    installPath: SAMPLE_SERVER,
    worldId: "w-hollow",
    slot: 0,
    notes: "Primary community box. playit.gg Palworld tunnel.",
    listenAt: startedAt,
    queryBound: false,
    tunnel: {
      provider: "playit",
      status: "online",
      agentInstalled: true,
      claimUrl: "https://playit.gg/claim/H4L0W1",
      claimCode: "H4L0W1",
      tunnelId: "playit-hollow-isle-0",
      region: "global-anycast",
      localPort: 8211,
      game: { host: "hollow-isle.gl.at.ply.gg", port: 30051, ip: "147.185.221.40" },
      query: null,
      lastError: "",
      startedAt,
      agentVersion: "0.17.1",
    },
  });
  const yard = normalizeInstance({
    id: "srv-yard",
    name: "Build Yard",
    description: "Creative sandbox. LAN plus a PortWarp tunnel when friends drop in.",
    running: false,
    startedAt: null,
    version: CURRENT_GAME,
    build: "1120515",
    ...portsForSlot(1),
    maxPlayers: 8,
    community: false,
    publicIp: "",
    players: [],
    versions: SERVER_VERSIONS,
    history: [CURRENT_GAME],
    imported: false,
    importedFrom: "",
    installPath: "C:\\PalServers\\BuildYard",
    worldId: "w-sandbox",
    slot: 1,
    notes: "Second PalServer on the same host. UDP 8221.",
    tunnel: idleTunnel(8221, "none"),
  });

  return {
    onboarded: true,
    mode: "both",
    paths: { client: SAMPLE_CLIENT, server: SAMPLE_SERVER },
    keys: { nexus: "", curseforge: "", steam: "" },
    autoBackup: true,
    crashWatchdog: true,
    captureConsole: true,
    checkModUpdates: true,
    guideDismissed: false,
    checkerRan: true,
    server: hollow,
    instances: [hollow, yard],
    activeServerId: "srv-hollow",
    worlds: [
      {
        id: "w-hollow",
        name: "Hollow Isle",
        guid: "A91C2E44-11F0-4B3A-9D70-77C1B2AA9012",
        active: true,
        days: 118,
        lastPlayed: new Date().toISOString(),
        sizeMb: 1840,
        guilds: 6,
        optionOverride: true,
      },
      {
        id: "w-sandbox",
        name: "Build Yard",
        guid: "B10DE882-90AA-4C21-8F11-0012CCD41990",
        active: false,
        days: 14,
        lastPlayed: "2026-08-30T18:11:00.000Z",
        sizeMb: 220,
        guilds: 1,
        optionOverride: false,
      },
    ],
    backups: [
      {
        id: "b1",
        worldId: "w-hollow",
        worldName: "Hollow Isle",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        sizeMb: 1840,
        kind: "auto",
        label: "Six-hour auto",
        version: CURRENT_GAME,
      },
      {
        id: "b2",
        worldId: "w-hollow",
        worldName: "Hollow Isle",
        createdAt: "2026-07-10T04:10:00.000Z",
        sizeMb: 1760,
        kind: "pre-update",
        label: "Before 1.0.0",
        version: "0.7.3",
      },
    ],
    mods,
    frameworks: {
      ue4ss: {
        id: "ue4ss",
        name: "UE4SS",
        clientVersion: null,
        serverVersion: "2281fa31",
        latestKnown: "2281fa31",
        assetName: "UE4SS-Palworld.zip",
        updatedAt: "2026-09-03T21:06:00.000Z",
      },
      palschema: {
        id: "palschema",
        name: "PalSchema",
        clientVersion: "0.6.71",
        serverVersion: "0.6.71",
        latestKnown: "0.6.71",
        assetName: "PalSchema.zip",
        updatedAt: "2026-09-09T14:45:00.000Z",
      },
      reshade: {
        id: "reshade",
        name: "ReShade",
        clientVersion: null,
        serverVersion: null,
        latestKnown: "6.5.1",
        assetName: null,
        updatedAt: null,
      },
      optiscaler: {
        id: "optiscaler",
        name: "OptiScaler",
        clientVersion: null,
        serverVersion: null,
        latestKnown: "0.7.9",
        assetName: null,
        updatedAt: null,
      },
    },
    launchArgs: defaultLaunchArgs().map((a) => {
      if (a.id === "publiclobby") return { ...a, enabled: true };
      if (a.id === "workers") return { ...a, enabled: true, value: "4" };
      return a;
    }),
    worldSettings: defaultSettings().map((s) => {
      const overrides: Record<string, string> = {
        ServerName: "Hollow Isle",
        ServerDescription: "A quiet community world. No griders.",
        ServerPlayerMaxNum: "32",
        PalEggDefaultHatchingTime: "24",
        DeathPenalty: "Item",
        RESTAPIEnabled: "True",
        RCONEnabled: "True",
        BaseCampWorkerMaxNum: "20",
        ExpRate: "1.000000",
        NightTimeSpeedRate: "1.500000",
      };
      return overrides[s.key] ? { ...s, value: overrides[s.key] } : s;
    }),
    worldSaves: {
      "w-hollow": {
        worldId: "w-hollow",
        optionOverride: true,
        worldTime: "Day 118 · 14:20",
        players: [
          { id: "p-mira", name: "Mira", uid: "00000000-0000-0000-0000-000000000001", steamId: "76561198000001", level: 72, exp: 482400, guild: "Shoal", pals: 38, lastSeen: new Date().toISOString(), online: true },
          { id: "p-ren", name: "Ren", uid: "00000000-0000-0000-0000-000000000002", steamId: "76561198000002", level: 54, exp: 261200, guild: "Shoal", pals: 21, lastSeen: new Date().toISOString(), online: true },
          { id: "p-ivy", name: "Ivy", uid: "00000000-0000-0000-0000-000000000003", steamId: "76561198000003", level: 68, exp: 410100, guild: "Ashwalkers", pals: 44, lastSeen: new Date().toISOString(), online: true },
          { id: "p-kade", name: "Kade", uid: "00000000-0000-0000-0000-000000000004", steamId: "76561198000004", level: 22, exp: 41000, guild: "", pals: 9, lastSeen: new Date().toISOString(), online: true },
          { id: "p-nori", name: "Nori", uid: "00000000-0000-0000-0000-000000000005", steamId: "76561198000005", level: 40, exp: 150000, guild: "Ember", pals: 27, lastSeen: "2026-09-17T11:02:00.000Z", online: false },
          { id: "p-sol", name: "Sol", uid: "00000000-0000-0000-0000-000000000006", steamId: "76561198000006", level: 29, exp: 70400, guild: "Tide", pals: 16, lastSeen: "2026-09-14T22:40:00.000Z", online: false },
        ],
        guilds: [
          { id: "g-shoal", name: "Shoal", owner: "Mira", members: 2, bases: 3 },
          { id: "g-ash", name: "Ashwalkers", owner: "Ivy", members: 1, bases: 2 },
          { id: "g-ember", name: "Ember", owner: "Nori", members: 1, bases: 1 },
          { id: "g-tide", name: "Tide", owner: "Sol", members: 1, bases: 1 },
          { id: "g-glass", name: "Glass", owner: "—", members: 0, bases: 1 },
          { id: "g-hollow", name: "Hollow", owner: "—", members: 0, bases: 0 },
        ],
        imported: {
          name: "WorldOption.sav",
          kind: "worldoption",
          size: 18400,
          at: "2026-09-12T08:00:00.000Z",
          note: "WorldOption.sav is present. Gameplay keys in PalWorldSettings.ini are ignored until you remove it.",
        },
      },
      "w-sandbox": {
        worldId: "w-sandbox",
        optionOverride: false,
        worldTime: "Day 14 · 09:00",
        players: [
          { id: "p-yard", name: "Yardkeep", uid: "00000000-0000-0000-0000-000000000010", steamId: "76561198000010", level: 18, exp: 22000, guild: "Yard", pals: 6, lastSeen: "2026-08-30T18:11:00.000Z", online: false },
        ],
        guilds: [{ id: "g-yard", name: "Yard", owner: "Yardkeep", members: 1, bases: 1 }],
      },
    },
    engineTweaks: defaultEngineTweaks(),
    logs,
    monitor: {
      samples: seedHistory({
        running: true,
        startedAt,
        players: 4,
        worldMb: 1840,
        restOn: true,
      }),
      session: defaultSession(4, 6),
      thresholds: emptyMonitor().thresholds,
    },
    ops: {
      ...defaultOps(),
      layout: "copy",
      scheduleBackupHours: 6,
      backupKeep: 7,
      startTunnels: true,
      ue4ssChannel: "stable",
    },
    profiles: [
      {
        id: "prof-pve",
        name: "PvE community",
        notes: "Everything except broken packs.",
        enabledIds: mods.filter((m) => m.enabled && !m.broken).map((m) => m.id),
      },
    ],
    bans: [{ id: "ban-demo", steamId: "76561197999999", name: "Gridlord", reason: "Base wipe", at: "2026-09-12T11:00:00.000Z" }],
    allow: [],
    consoleLines: {
      "srv-hollow": [
        { id: "c1", ts: startedAt, stream: "out" as const, text: "Setting breakpad minidump AppID = 2394010" },
        { id: "c2", ts: startedAt, stream: "out" as const, text: "Game version is v1.0.5.1120515" },
        { id: "c3", ts: startedAt, stream: "out" as const, text: "Running Palworld dedicated server on :8211" },
        { id: "c4", ts: new Date().toISOString(), stream: "out" as const, text: "LogPal: Display: WorldSave completed." },
      ],
    },
    denSettings: {},
    lastBackupAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    lastRestartDay: "",
  };
}

export function freshConfigured(mode: AppMode, paths: PathsState, imported?: { name?: string; ini?: string }): PalnestState {
  const base = emptyState();
  base.onboarded = true;
  base.mode = mode;
  base.paths = paths;
  if (mode !== "client") {
    base.server.name = imported?.name || "Palnest World";
    base.server.installPath = paths.server;
    base.worlds = [
      {
        id: "w-new",
        name: imported?.name || "World 01",
        guid: "00000000-0000-4000-8000-000000000001",
        active: true,
        days: 0,
        lastPlayed: new Date().toISOString(),
        sizeMb: 12,
        guilds: 0,
        optionOverride: false,
      },
    ];
    base.worldSaves = {
      [base.worlds[0].id]: {
        worldId: base.worlds[0].id,
        optionOverride: false,
        worldTime: "Day 0 · 08:00",
        players: [],
        guilds: [],
      },
    };
    base.server.worldId = base.worlds[0].id;
    if (imported?.name) {
      base.server.imported = true;
      base.server.importedFrom = paths.server;
      base.server.installPath = paths.server;
    }
    base.instances = [base.server];
    base.activeServerId = base.server.id;
  }
  base.logs = [
    {
      id: "boot",
      ts: new Date().toISOString(),
      level: "ok",
      source: "palnest",
      message:
        mode === "client"
          ? "Client world ready. Game path is optional until you install a mod."
          : mode === "server"
            ? "Server world ready. No game client required."
            : "Client and server world ready.",
    },
  ];
  return base;
}
