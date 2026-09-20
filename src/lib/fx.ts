import { nid } from "./utils.ts";
import type { InstallTarget } from "./types.ts";

export type OptiFgOutput = "off" | "fsr" | "xess" | "nukem";
export type OptiFgInput = "off" | "upscaler" | "fsr" | "fsr3" | "dlssg" | "nukem";
export type OptiFsrUpgrade = "auto" | "on" | "off";

export interface EngineBlock {
  id: string;
  name: string;
  version?: string;
  source?: string;
  target: InstallTarget;
  lines: string;
  enabled: boolean;
}

export interface ModHistoryEntry {
  id: string;
  name: string;
  action: "install" | "uninstall" | "update" | "enable" | "disable" | "identify";
  at: string;
  detail: string;
}

export interface UnidentifiedFile {
  id: string;
  path: string;
  kind: string;
  at: string;
  dismissed?: boolean;
}

export interface ReshadePreset {
  id: string;
  name: string;
  source: "manual" | "pack";
  effects: string;
  active: boolean;
}

export interface ReshadeAddon {
  id: string;
  name: string;
  note: string;
  enabled: boolean;
}

export interface Ue4ssConsole {
  debugWindow: boolean;
  inGame: boolean;
  showOnStart: boolean;
}

export interface ClientFx {
  uiScale: number;
  engineBlocks: EngineBlock[];
  optiFgOutput: OptiFgOutput;
  optiFgInput: OptiFgInput;
  optiDx12: string;
  optiDx11: string;
  optiVulkan: string;
  optiFsr4: OptiFsrUpgrade;
  reshadePresetId: string;
  reshadePresets: ReshadePreset[];
  reshadeAddons: ReshadeAddon[];
  palSchemaLang: string;
  palSchemaHotReload: boolean;
  palSchemaVerbose: boolean;
  palSchemaClient: boolean;
  palSchemaServer: boolean;
  ue4ssClient: Ue4ssConsole;
  ue4ssServer: Ue4ssConsole;
  ue4ssLoadedOnStart: boolean;
  history: ModHistoryEntry[];
  unidentified: UnidentifiedFile[];
  engineIniClient?: string;
  engineIniServer?: string;
}

export function defaultEngineBlocks(): EngineBlock[] {
  return [
    {
      id: "blk-uet",
      name: "Ultimate Engine Tweaks (Anti-Stutters)",
      version: "v12",
      source: "Nexus",
      target: "client",
      enabled: true,
      lines: `; Ultimate Engine Tweaks — Palnest managed block
[/Script/Engine.Engine]
bAllowMultiThreadedShaderCompile=1
r.GTSyncType=1
r.OneFrameThreadLag=1
r.FinishCurrentFrame=0`,
    },
    {
      id: "blk-view",
      name: "View Distance Pop-in Shadows",
      version: "v1.1",
      target: "client",
      enabled: true,
      lines: `[/Script/Engine.RendererSettings]
r.ViewDistanceScale=1.5
r.Shadow.DistanceScale=1.2
r.Shadow.Virtual.Enable=1`,
    },
    {
      id: "blk-ultra",
      name: "Ultra Graphics",
      source: "UltraGraphics",
      target: "client",
      enabled: false,
      lines: `[/Script/Engine.RendererSettings]
r.Streaming.PoolSize=70
r.MaxAnisotropy=16
r.Tonemapper.Sharpen=0.8`,
    },
    {
      id: "blk-lumen",
      name: "Lumen Quality Tweaks",
      target: "client",
      enabled: false,
      lines: `[/Script/Engine.RendererSettings]
r.Lumen.DiffuseIndirect.Allow=1
r.Lumen.Reflections.Allow=1
r.Lumen.TraceMeshSDFs=0`,
    },
  ];
}

export function defaultFx(): ClientFx {
  return {
    uiScale: 90,
    engineBlocks: defaultEngineBlocks(),
    optiFgOutput: "fsr",
    optiFgInput: "upscaler",
    optiDx12: "fsr31",
    optiDx11: "fsr31",
    optiVulkan: "auto",
    optiFsr4: "auto",
    reshadePresetId: "weakdayz",
    reshadePresets: [
      { id: "weakdayz-free", name: "Weakdayz-Free.ini", source: "manual", effects: "Clarity, MMJCelShader, Lightroom", active: false },
      { id: "weakdayz", name: "Weakdayz.ini", source: "manual", effects: "MartysMods_Clarity, ReGrade, Sharpen", active: true },
      { id: "weakdayz-flat", name: "Weakdayz_backup_flat.ini", source: "manual", effects: "MartysMods_Clarity, ReGrade", active: false },
      { id: "weakdayz-dedupe", name: "Weakdayz_backup_pre_dedupe.ini", source: "manual", effects: "MartysMods_Clarity", active: false },
      { id: "weakdayz-outline", name: "Weakdayz_backup_pre_outline.ini", source: "manual", effects: "MartysMods_Clarity, ReGrade", active: false },
    ],
    reshadeAddons: [
      { id: "lut", name: "MartysMods LUT Manager", note: "Color LUTs from the game folder.", enabled: false },
      { id: "regrade", name: "ReGrade+", note: "Contrast and grade stack.", enabled: false },
      { id: "toggler", name: "Reshade Effect Shader Toggler", note: "Masks ReShade from the game UI.", enabled: false },
    ],
    palSchemaLang: "",
    palSchemaHotReload: false,
    palSchemaVerbose: false,
    palSchemaClient: true,
    palSchemaServer: true,
    ue4ssClient: { debugWindow: false, inGame: false, showOnStart: false },
    ue4ssServer: { debugWindow: false, inGame: false, showOnStart: false },
    ue4ssLoadedOnStart: true,
    history: [],
    unidentified: [],
  };
}

export function mergeFx(raw?: Partial<ClientFx> | null): ClientFx {
  const base = defaultFx();
  if (!raw) return base;
  return {
    ...base,
    ...raw,
    engineBlocks: raw.engineBlocks?.length ? raw.engineBlocks : base.engineBlocks,
    reshadePresets: raw.reshadePresets?.length ? raw.reshadePresets : base.reshadePresets,
    reshadeAddons: raw.reshadeAddons?.length ? raw.reshadeAddons : base.reshadeAddons,
    ue4ssClient: { ...base.ue4ssClient, ...raw.ue4ssClient },
    ue4ssServer: { ...base.ue4ssServer, ...raw.ue4ssServer },
    history: raw.history ?? [],
    unidentified: raw.unidentified ?? [],
  };
}

export function pushHistory(list: ModHistoryEntry[], entry: Omit<ModHistoryEntry, "id" | "at"> & { id?: string; at?: string }) {
  return [
    {
      id: entry.id ?? nid("hist"),
      at: entry.at ?? new Date().toISOString(),
      name: entry.name,
      action: entry.action,
      detail: entry.detail,
    },
    ...list,
  ].slice(0, 80);
}

export function parsePastedIni(raw: string): { name: string; lines: string; keys: string[] } {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const first = text.split("\n").find((l) => l.trim() && !l.trim().startsWith(";")) ?? "Imported tweak";
  const name = first.startsWith("[") ? "Imported Engine.ini block" : first.replace(/^;+\s*/, "").slice(0, 72) || "Imported tweak";
  const keys = [...text.matchAll(/^([A-Za-z0-9_.]+)\s*=/gm)].map((m) => m[1]);
  return { name, lines: text, keys };
}

export function composeEngineIni(opts: {
  tweaksIni: string;
  blocks: EngineBlock[];
  target: InstallTarget;
  uiScale: number;
}): string {
  const blocks = opts.blocks.filter((b) => b.enabled && (b.target === "both" || b.target === opts.target));
  const parts = [opts.tweaksIni.trim()];
  if (opts.target === "client" && opts.uiScale !== 100) {
    parts.push(
      `; === Palnest UI Scale ===`,
      `[/Script/Engine.UserInterfaceSettings]`,
      `ApplicationScale=${(opts.uiScale / 100).toFixed(2)}`,
    );
  }
  for (const b of blocks) {
    parts.push(`; === ${b.name}${b.version ? ` ${b.version}` : ""} ===`, b.lines.trim());
  }
  return parts.filter(Boolean).join("\n\n") + "\n";
}

export const OPTI_DX12 = [
  { id: "auto", label: "Auto" },
  { id: "fsr31", label: "FSR 3.1" },
  { id: "fsr22", label: "FSR 2.2" },
  { id: "xess", label: "XeSS" },
  { id: "dlss", label: "DLSS" },
];

export const OPTI_DX11 = [
  { id: "auto", label: "Auto" },
  { id: "fsr31", label: "FSR 3.1 (DX11 on 12)" },
  { id: "fsr22", label: "FSR 2.2" },
];

export const UE4SS_BUILTINS = [
  "BPModLoaderMod",
  "CheatManagerEnablerMod",
  "ConsoleCommandsMod",
  "ConsoleEnablerMod",
  "SplitScreenMod",
  "LineTraceMod",
  "Keybinds",
  "jsbLuaProfilerMod",
  "Shared",
];
