export type AppMode = "client" | "server" | "both";

export type ModKind = "ue4ss" | "palschema" | "pak" | "ini" | "reshade" | "framework";

export type ModSource = "nexus" | "steam" | "curseforge" | "github" | "local";

export type InstallTarget = "client" | "server" | "both";

export interface ModFileChoice {
  id: string;
  name: string;
  sizeKb: number;
  kind: ModKind;
  note: string;
  url?: string;
}

export type FindingSeverity = "error" | "warn" | "info";

export type FindingKind =
  | "broken"
  | "unsupported"
  | "outdated"
  | "missing-dep"
  | "server-incompatible"
  | "client-incompatible"
  | "orphan"
  | "conflict";

export interface CatalogMod {
  id: string;
  name: string;
  author: string;
  version: string;
  kind: ModKind;
  source: ModSource;
  sourceId: string;
  url: string;
  downloads: number;
  endorsements: number;
  category: string;
  description: string;
  gameVersions: string[];
  requires: string[];
  serverCompatible: boolean;
  clientCompatible: boolean;
  sizeKb: number;
  updatedAt: string;
  tags: string[];
}

export interface InstalledMod {
  id: string;
  catalogId?: string;
  name: string;
  author: string;
  version: string;
  latestVersion: string;
  kind: ModKind;
  source: ModSource;
  sourceId: string;
  target: InstallTarget;
  enabled: boolean;
  loadOrder: number;
  gameVersions: string[];
  requires: string[];
  serverCompatible: boolean;
  clientCompatible: boolean;
  description: string;
  category: string;
  installPath: string;
  fileCount: number;
  sizeKb: number;
  installedAt: string;
  updatedAt: string;
  broken?: boolean;
  notes?: string;
}

export interface FrameworkInstall {
  id: "ue4ss" | "palschema" | "reshade" | "optiscaler";
  name: string;
  clientVersion: string | null;
  serverVersion: string | null;
  latestKnown: string | null;
  assetName: string | null;
  updatedAt: string | null;
}

export interface ServerVersion {
  id: string;
  version: string;
  channel: "stable" | "experimental";
  releasedAt: string;
  notes: string;
}

export interface WorldInfo {
  id: string;
  name: string;
  guid: string;
  active: boolean;
  days: number;
  lastPlayed: string;
  sizeMb: number;
  guilds: number;
  optionOverride?: boolean;
}

export interface SavePlayer {
  id: string;
  name: string;
  uid: string;
  steamId: string;
  level: number;
  exp: number;
  guild: string;
  pals: number;
  lastSeen: string;
  online?: boolean;
}

export interface SaveGuild {
  id: string;
  name: string;
  owner: string;
  members: number;
  bases: number;
}

export interface WorldSaveData {
  worldId: string;
  optionOverride: boolean;
  worldTime: string;
  players: SavePlayer[];
  guilds: SaveGuild[];
  imported?: {
    name: string;
    kind: SavKind;
    size: number;
    at: string;
    note?: string;
  };
}

export type SavKind = "worldoption" | "level" | "world" | "meta" | "player" | "snapshot" | "unknown";

export interface WorldSnapshot {
  palnest: 1;
  kind: "world-snapshot";
  world: Pick<WorldInfo, "id" | "name" | "guid" | "days" | "sizeMb">;
  optionOverride: boolean;
  settings: Record<string, string>;
  players: SavePlayer[];
  guilds: SaveGuild[];
}

export interface WorldSetting {
  key: string;
  label: string;
  group: string;
  type: "number" | "bool" | "string" | "enum" | "array";
  value: string;
  defaultValue: string;
  hint: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  format?: "int" | "float";
  enumType?: string;
}

export interface BackupInfo {
  id: string;
  worldId: string;
  worldName: string;
  createdAt: string;
  sizeMb: number;
  kind: "auto" | "manual" | "pre-update" | "pre-rollback";
  label: string;
  version: string;
  zipPath?: string;
}

export interface LogEntry {
  id: string;
  ts: string;
  level: "info" | "warn" | "error" | "ok";
  source: string;
  message: string;
}

export interface LaunchArg {
  id: string;
  flag: string;
  value: string;
  enabled: boolean;
  note: string;
  category: "threading" | "network" | "logging" | "community" | "custom";
  builtin: boolean;
}

export interface EngineTweak {
  id: string;
  section: string;
  key: string;
  value: string;
  enabled: boolean;
  hint: string;
  target: InstallTarget;
  group?: "tick" | "network" | "memory" | "streaming" | "visual";
  lines?: string[];
}

export interface PlayerInfo {
  name: string;
  playerId: string;
  level: number;
  ping: number;
  location: string;
  guild: string;
  online: boolean;
}

export interface Finding {
  id: string;
  severity: FindingSeverity;
  kind: FindingKind;
  title: string;
  detail: string;
  modId?: string;
  fixLabel?: string;
  fixAction?: "disable" | "update" | "install-ue4ss" | "install-palschema" | "uninstall";
}

export interface RemoteRelease {
  repo: string;
  tag: string;
  name: string;
  publishedAt: string;
  body: string;
  htmlUrl: string;
  assets: { name: string; size: number; url: string; downloadUrl: string }[];
  prerelease: boolean;
}

export interface SearchHit {
  id: string;
  name: string;
  author: string;
  version: string;
  source: ModSource;
  sourceId: string;
  url: string;
  downloads: number;
  description: string;
  kind: ModKind;
  updatedAt: string;
  serverCompatible: boolean;
  gameVersions: string[];
  requires: string[];
  files?: ModFileChoice[];
}

export type TunnelProvider = "none" | "playit" | "portwarp";

export type TunnelStatus = "idle" | "installing" | "claim" | "connecting" | "online" | "offline" | "error";

export interface TunnelEndpoint {
  host: string;
  port: number;
  ip: string;
}

export interface TunnelState {
  provider: TunnelProvider;
  status: TunnelStatus;
  agentInstalled: boolean;
  claimUrl: string;
  claimCode: string;
  tunnelId: string;
  region: string;
  localPort: number;
  game: TunnelEndpoint | null;
  query: TunnelEndpoint | null;
  lastError: string;
  startedAt: string | null;
  agentVersion: string;
}

export interface ServerState {
  id: string;
  name: string;
  description: string;
  running: boolean;
  startedAt: string | null;
  version: string;
  build: string;
  port: number;
  queryPort: number;
  restPort: number;
  rconPort: number;
  maxPlayers: number;
  community: boolean;
  publicIp: string;
  players: PlayerInfo[];
  versions: ServerVersion[];
  history: string[];
  imported: boolean;
  importedFrom: string;
  installPath: string;
  worldId: string;
  slot: number;
  notes: string;
  tunnel: TunnelState;
  pid: number | null;
  layout: "shared" | "copy";
  autostart: boolean;
  writtenAt: string | null;
  /** ISO time PalServer actually bound the game UDP port. Null while the process is up but not listening. */
  listenAt: string | null;
  /** Steam query is listening as UDP (not TCP). PortWarp extra maps only then. */
  queryBound: boolean;
}

export interface PathsState {
  client: string;
  server: string;
}

export interface KeysState {
  nexus: string;
  curseforge: string;
  steam: string;
}
