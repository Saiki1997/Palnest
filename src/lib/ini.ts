import type { WorldSetting } from "./types";

type Def = Omit<WorldSetting, "value">;

function d(
  key: string,
  label: string,
  group: string,
  type: WorldSetting["type"],
  defaultValue: string,
  hint: string,
  extra: Partial<Def> = {},
): Def {
  return { key, label, group, type, defaultValue, hint, ...extra };
}

const F = { format: "float" as const, step: 0.1 };
const I = { format: "int" as const, step: 1 };

export const SETTING_DEFS: Def[] = [
  d("ServerName", "Server name", "Identity", "string", "Default Palworld Server", "Shown in the community list and Steam browser."),
  d("ServerDescription", "Description", "Identity", "string", "", "Keep it short. The browser truncates long blurbs."),
  d("ServerPassword", "Join password", "Identity", "string", "", "Leave empty for a public (or allow-list) world."),
  d("AdminPassword", "Admin password", "Identity", "string", "", "Used by RCON and in-game /AdminPassword."),
  d("Region", "Region", "Identity", "string", "", "Optional region tag on the community list."),
  d("PublicIP", "Public IP", "Identity", "string", "", "Set if the world should advertise a specific address."),

  d("PublicPort", "Public port", "Network", "number", "8211", "Game traffic. Forward UDP on the router.", { ...I, min: 1024, max: 65535 }),
  d("RCONEnabled", "RCON", "Network", "bool", "False", "Remote console. Pair with a strong admin password."),
  d("RCONPort", "RCON port", "Network", "number", "25575", "TCP. Do not expose it without a firewall.", { ...I, min: 1024, max: 65535 }),
  d("RESTAPIEnabled", "REST API", "Network", "bool", "False", "Needed for player lists and graceful shutdown from Palnest."),
  d("RESTAPIPort", "REST port", "Network", "number", "8212", "HTTP. Bind to LAN if you can.", { ...I, min: 1024, max: 65535 }),
  d("bUseAuth", "Official auth", "Network", "bool", "True", "Talk to Pocketpair auth. Leave on unless you know why not."),
  d("BanListURL", "Ban list URL", "Network", "string", "https://b.palworldgame.com/api/banlist.txt", "Official global ban list. Empty disables it."),
  d("bShowPlayerList", "Show player list", "Network", "bool", "False", "Publish the in-game player list to the REST API."),
  d("bIsShowJoinLeftMessage", "Join / leave chat", "Network", "bool", "True", "Announce when someone connects or drops."),
  d("ChatPostLimitPerMinute", "Chat per minute", "Network", "number", "30", "Rate-limit public chat.", { ...I, min: 0, max: 120 }),
  d(
    "CrossplayPlatforms",
    "Crossplay platforms",
    "Network",
    "array",
    "Steam,Xbox,PS5,Mac",
    "Who may join. Comma-separated: Steam, Xbox, PS5, Mac.",
    { enumType: "EPalAllowConnectPlatform", options: ["Steam", "Xbox", "PS5", "Mac"] },
  ),
  d("LogFormatType", "Log format", "Network", "enum", "Text", "Dedicated log output.", {
    options: ["Text", "Json"],
    enumType: "EPalOptionWorldLogFormatType",
  }),
  d("bAllowClientMod", "Allow client mods", "Network", "bool", "True", "Let joining clients keep their UE4SS / PAK stack."),

  d("ServerPlayerMaxNum", "Max players", "Population", "number", "32", "Hard cap on dedicated. 32 is the usual community ceiling.", { ...I, min: 1, max: 64 }),
  d("CoopPlayerMaxNum", "Co-op party size", "Population", "number", "4", "Players that can share a party.", { ...I, min: 1, max: 32 }),
  d("GuildPlayerMaxNum", "Guild size", "Population", "number", "20", "How large a single guild may grow.", { ...I, min: 1, max: 50 }),
  d("BaseCampMaxNum", "World base camps", "Population", "number", "128", "Global camp cap for the whole island.", { ...I, min: 1, max: 256 }),
  d("BaseCampMaxNumInGuild", "Camps per guild", "Population", "number", "4", "Per-guild camp limit.", { ...I, min: 1, max: 20 }),
  d("BaseCampWorkerMaxNum", "Base workers", "Population", "number", "15", "Pals assigned per camp. Dedicated ignores this in the INI — put it in WorldOption.sav.", { ...I, min: 1, max: 50 }),
  d("MaxBuildingLimitNum", "Building limit", "Population", "number", "0", "0 is unlimited. A cap helps packed worlds.", { ...I, min: 0, max: 10000 }),

  d("Difficulty", "Difficulty", "Rates", "enum", "None", "None keeps the multipliers below. Other presets can override them.", {
    options: ["None", "Casual", "Normal", "Hard"],
    enumType: "EPalOptionWorldDifficulty",
  }),
  d("DayTimeSpeedRate", "Day speed", "Rates", "number", "1.000000", "Above 1 shortens daylight.", { ...F, min: 0.1, max: 5 }),
  d("NightTimeSpeedRate", "Night speed", "Rates", "number", "1.000000", "Raise this if nights feel too long.", { ...F, min: 0.1, max: 5 }),
  d("ExpRate", "XP rate", "Rates", "number", "1.000000", "Player and pal experience.", { ...F, min: 0.1, max: 20 }),
  d("PalCaptureRate", "Capture rate", "Rates", "number", "1.000000", "Sphere success multiplier.", { ...F, min: 0.1, max: 5 }),
  d("PalSpawnNumRate", "Pal spawn density", "Rates", "number", "1.000000", "Above 1.5 hurts dedicated tick. Prefer 1.0 on 32-slot worlds.", { ...F, min: 0.1, max: 3 }),
  d("WorkSpeedRate", "Work speed", "Rates", "number", "1.000000", "Crafting and pal work.", { ...F, min: 0.1, max: 5 }),
  d("CollectionDropRate", "Gather rate", "Rates", "number", "1.000000", "Trees, ore, and pickups.", { ...F, min: 0.1, max: 10 }),
  d("CollectionObjectHpRate", "Node HP", "Rates", "number", "1.000000", "How tough gather nodes are.", { ...F, min: 0.1, max: 5 }),
  d("CollectionObjectRespawnSpeedRate", "Node respawn", "Rates", "number", "1.000000", "How fast trees and ore come back.", { ...F, min: 0.1, max: 10 }),
  d("PalEggDefaultHatchingTime", "Hatch hours", "Rates", "number", "1.000000", "Vanilla large eggs are 1 hour on 1.0. Older worlds used 72.", { ...F, min: 0, max: 240 }),
  d("MonsterFarmActionSpeedRate", "Farm speed", "Rates", "number", "1.000000", "Ranch and farm pal actions.", { ...F, min: 0.1, max: 10 }),
  d("SupplyDropSpan", "Supply drop minutes", "Rates", "number", "180", "Minutes between world supply drops.", { ...I, min: 1, max: 1440 }),

  d("PalDamageRateAttack", "Pal attack", "Damage", "number", "1.000000", "Damage wild and owned pals deal.", { ...F, min: 0.1, max: 5 }),
  d("PalDamageRateDefense", "Pal defense", "Damage", "number", "1.000000", "Damage pals take. Raise to make them squishier.", { ...F, min: 0.1, max: 5 }),
  d("PlayerDamageRateAttack", "Player attack", "Damage", "number", "1.000000", "Damage players deal.", { ...F, min: 0.1, max: 5 }),
  d("PlayerDamageRateDefense", "Player defense", "Damage", "number", "1.000000", "Damage players take.", { ...F, min: 0.1, max: 5 }),
  d("BuildObjectHpRate", "Structure HP", "Damage", "number", "1.000000", "Health of built pieces.", { ...F, min: 0.1, max: 10 }),
  d("BuildObjectDamageRate", "Structure damage", "Damage", "number", "1.000000", "Damage dealt to buildings.", { ...F, min: 0.1, max: 10 }),
  d("BuildObjectDeteriorationDamageRate", "Decay rate", "Damage", "number", "1.000000", "How fast unpowered structures rot.", { ...F, min: 0, max: 10 }),
  d("EquipmentDurabilityDamageRate", "Durability wear", "Damage", "number", "1.000000", "Weapon and armor wear.", { ...F, min: 0, max: 10 }),

  d("PlayerStomachDecreaceRate", "Player hunger", "Survival", "number", "1.000000", "How fast players get hungry.", { ...F, min: 0, max: 5 }),
  d("PlayerStaminaDecreaceRate", "Player stamina drain", "Survival", "number", "1.000000", "Sprint and climb drain.", { ...F, min: 0, max: 5 }),
  d("PlayerAutoHPRegeneRate", "Player regen", "Survival", "number", "1.000000", "Out-of-combat health regen.", { ...F, min: 0, max: 5 }),
  d("PlayerAutoHpRegeneRateInSleep", "Player sleep regen", "Survival", "number", "1.000000", "Regen while sleeping.", { ...F, min: 0, max: 10 }),
  d("PalStomachDecreaceRate", "Pal hunger", "Survival", "number", "1.000000", "How fast pals get hungry.", { ...F, min: 0, max: 5 }),
  d("PalStaminaDecreaceRate", "Pal stamina drain", "Survival", "number", "1.000000", "Pal stamina use.", { ...F, min: 0, max: 5 }),
  d("PalAutoHPRegeneRate", "Pal regen", "Survival", "number", "1.000000", "Pal health regen.", { ...F, min: 0, max: 5 }),
  d("PalAutoHpRegeneRateInSleep", "Pal sleep regen", "Survival", "number", "1.000000", "Pal regen at a bed.", { ...F, min: 0, max: 10 }),
  d("ItemWeightRate", "Item weight", "Survival", "number", "1.000000", "Inventory weight multiplier.", { ...F, min: 0.1, max: 5 }),
  d("ItemCorruptionMultiplier", "Item decay", "Survival", "number", "1.000000", "Food and corpse spoilage.", { ...F, min: 0, max: 10 }),

  d("EnemyDropItemRate", "Enemy drops", "Drops", "number", "1.000000", "Loot from wild pals and bosses.", { ...F, min: 0.1, max: 10 }),
  d("DropItemMaxNum", "Max dropped items", "Drops", "number", "3000", "World item cap. High values cost RAM.", { ...I, min: 100, max: 20000 }),
  d("PhysicsActiveDropItemMaxNum", "Physics drops", "Drops", "number", "-1", "-1 uses the engine default.", { ...I, min: -1, max: 5000 }),
  d("DropItemMaxNum_UNKO", "Max dung drops", "Drops", "number", "100", "Cap on pal dung piles.", { ...I, min: 0, max: 1000 }),
  d("DropItemAliveMaxHours", "Drop lifetime hours", "Drops", "number", "1.000000", "How long ground loot stays.", { ...F, min: 0, max: 72 }),
  d("bActiveUNKO", "Pal dung", "Drops", "bool", "False", "Spawn dung piles. Off is kinder on tick."),

  d("bIsPvP", "PvP", "Rules", "bool", "False", "Player versus player. Also review friendly fire."),
  d("DeathPenalty", "Death penalty", "Rules", "enum", "Item", "None is kinder for public worlds. All is hardcore.", {
    options: ["None", "Item", "ItemAndEquipment", "All"],
    enumType: "EPalOptionWorldDeathPenalty",
  }),
  d("bEnableInvaderEnemy", "Raid invaders", "Rules", "bool", "True", "Faction raids on player bases."),
  d("EnablePredatorBossPal", "Predator bosses", "Rules", "bool", "True", "Allow predator-type boss pals."),
  d("bEnableFastTravel", "Fast travel", "Rules", "bool", "True", "Statue and camp fast travel."),
  d("bEnableFastTravelOnlyBaseCamp", "Fast travel camps only", "Rules", "bool", "False", "Restrict fast travel to base camps."),
  d("bIsStartLocationSelectByMap", "Pick spawn on map", "Rules", "bool", "False", "1.0 default is off. New characters choose a start location when True."),
  d("bEnablePlayerToPlayerDamage", "Player damage", "Rules", "bool", "False", "Players can hurt each other even outside PvP."),
  d("bEnableFriendlyFire", "Friendly fire", "Rules", "bool", "False", "Party and guild mates can be hit."),
  d("bHardcore", "Hardcore", "Rules", "bool", "False", "Character deletion on death."),
  d("bPalLost", "Lose pals on death", "Rules", "bool", "False", "Pals die with the trainer."),
  d("bCharacterRecreateInHardcore", "Recreate in hardcore", "Rules", "bool", "False", "Allow a new character after a hardcore death."),
  d("bCanPickupOtherGuildDeathPenaltyDrop", "Loot other guilds", "Rules", "bool", "False", "Pick up another guild's death bag."),
  d("bEnableNonLoginPenalty", "Offline penalty", "Rules", "bool", "True", "Hunger and similar tick while logged off."),
  d("bExistPlayerAfterLogout", "Keep body after logout", "Rules", "bool", "False", "Leave the character in the world when they disconnect."),
  d("bEnableDefenseOtherGuildPlayer", "Guild base defense", "Rules", "bool", "False", "Turrets fire on other guilds."),
  d("bInvisibleOtherGuildBaseCampAreaFX", "Hide other camp FX", "Rules", "bool", "False", "Do not show rival camp area markers."),
  d("bBuildAreaLimit", "Build area limit", "Rules", "bool", "False", "Restrict building to claimed camp land."),
  d("bAllowEnemyCampSpawnNearBaseCamp", "Enemy camps near bases", "Rules", "bool", "False", "Allow raid camps to spawn close to player bases."),
  d("bEnableAimAssistPad", "Pad aim assist", "Rules", "bool", "True", "Controller aim assist."),
  d("bEnableAimAssistKeyboard", "KBM aim assist", "Rules", "bool", "False", "Mouse aim assist. Usually off."),

  d("RandomizerType", "Randomizer", "Randomizer", "enum", "None", "Shuffle pal spawns. Region keeps biomes, All is chaos.", {
    options: ["None", "Region", "All"],
    enumType: "EPalRandomizerType",
  }),
  d("RandomizerSeed", "Randomizer seed", "Randomizer", "string", "", "Empty generates a seed on world create."),
  d("bIsRandomizerPalLevelRandom", "Random pal levels", "Randomizer", "bool", "False", "Ignore spawn-table levels when the randomizer is on."),

  d("bAutoResetGuildNoOnlinePlayers", "Reset idle guilds", "Guilds", "bool", "False", "Delete guilds that stay empty."),
  d("AutoResetGuildTimeNoOnlinePlayers", "Idle guild hours", "Guilds", "number", "72.000000", "Hours offline before an idle guild resets.", { ...F, min: 1, max: 720 }),
  d("GuildRejoinCooldownMinutes", "Rejoin cooldown", "Guilds", "number", "0", "Minutes before a player can rejoin a guild.", { ...I, min: 0, max: 10080 }),
  d("AutoTransferMasterCheckIntervalSeconds", "Master check seconds", "Guilds", "number", "3600.000000", "How often to look for an absent guild master.", { ...F, min: 60, max: 86400 }),
  d("AutoTransferMasterThresholdDays", "Master absent days", "Guilds", "number", "14", "Days offline before guild leadership transfers.", { ...I, min: 1, max: 90 }),
  d("MaxGuildsPerFrame", "Guilds per frame", "Guilds", "number", "10", "Sim budget. Lower if tick hitching on guild-heavy worlds.", { ...I, min: 1, max: 50 }),

  d("bAllowGlobalPalboxExport", "Global palbox export", "Palbox", "bool", "True", "Allow exporting pals to the global palbox."),
  d("bAllowGlobalPalboxImport", "Global palbox import", "Palbox", "bool", "False", "Allow importing pals from the global palbox."),
  d("DenyTechnologyList", "Denied technology", "Palbox", "string", "", "Comma-separated tech IDs players cannot unlock."),

  d("bIsPvP", "PvP", "Rules", "bool", "False", "Player versus player. Also review friendly fire."),

  d("BlockRespawnTime", "Respawn block seconds", "PvP", "number", "5.000000", "Forced wait after death.", { ...F, min: 0, max: 60 }),
  d("RespawnPenaltyDurationThreshold", "Respawn penalty threshold", "PvP", "number", "0.000000", "Seconds of combat before a longer respawn applies.", { ...F, min: 0, max: 300 }),
  d("RespawnPenaltyTimeScale", "Respawn penalty scale", "PvP", "number", "2.000000", "Multiplier on the extra wait.", { ...F, min: 1, max: 10 }),
  d("bDisplayPvPItemNumOnWorldMap_BaseCamp", "Map: camp item counts", "PvP", "bool", "False", "Show stored item counts on the world map."),
  d("bDisplayPvPItemNumOnWorldMap_Player", "Map: player item counts", "PvP", "bool", "False", "Show carried item counts on the world map."),
  d("bAdditionalDropItemWhenPlayerKillingInPvPMode", "PvP kill drops", "PvP", "bool", "False", "Extra loot when a player is killed."),
  d("AdditionalDropItemWhenPlayerKillingInPvPMode", "PvP drop item", "PvP", "string", "PlayerDropItem", "Item id granted on a PvP kill."),
  d("AdditionalDropItemNumWhenPlayerKillingInPvPMode", "PvP drop count", "PvP", "number", "1", "How many extra items drop on a PvP kill.", { ...I, min: 0, max: 50 }),

  d("bEnableVoiceChat", "Proximity voice", "Voice", "bool", "False", "1.0 dedicated voice. Off by default. Not available on WinGDK / Game Pass PC."),
  d("VoiceChatMaxVolumeDistance", "Voice full-volume cm", "Voice", "number", "3000.000000", "Range at full volume. 3000 is 30 m.", { ...F, min: 100, max: 50000 }),
  d("VoiceChatZeroVolumeDistance", "Voice silence cm", "Voice", "number", "15000.000000", "Range where voice fades out.", { ...F, min: 100, max: 100000 }),

  d("bAllowEnhanceStat_Health", "Enhance health", "Stats", "bool", "True", "Players may spend points on health."),
  d("bAllowEnhanceStat_Attack", "Enhance attack", "Stats", "bool", "True", "Players may spend points on attack."),
  d("bAllowEnhanceStat_Stamina", "Enhance stamina", "Stats", "bool", "True", "Players may spend points on stamina."),
  d("bAllowEnhanceStat_Weight", "Enhance weight", "Stats", "bool", "True", "Players may spend points on carry weight."),
  d("bAllowEnhanceStat_WorkSpeed", "Enhance work speed", "Stats", "bool", "True", "Players may spend points on work speed."),

  d("AutoSaveSpan", "Autosave minutes", "Advanced", "number", "30.000000", "Dedicated autosave interval.", { ...F, min: 1, max: 120 }),
  d("bIsUseBackupSaveData", "Rolling save backups", "Advanced", "bool", "True", "Keep Palworld's own save backups."),
  d("bIsMultiplay", "Force multiplay", "Advanced", "bool", "False", "Treat the session as multiplayer even solo."),
  d("ServerReplicatePawnCullDistance", "Pawn cull distance", "Advanced", "number", "15000.000000", "How far pals replicate. Lower helps tick.", { ...F, min: 1000, max: 50000 }),
  d("ItemContainerForceMarkDirtyInterval", "Container dirty interval", "Advanced", "number", "1.000000", "How often chests mark dirty for replication.", { ...F, min: 0.1, max: 30 }),
  d("PlayerDataPalStorageUpdateCheckTickInterval", "Pal storage tick", "Advanced", "number", "1.000000", "How often palbox contents are checked.", { ...F, min: 0.1, max: 30 }),
  d("bEnableBuildingPlayerUIdDisplay", "Show builder names", "Advanced", "bool", "False", "Display who placed a building."),
  d("BuildingNameDisplayCacheTTLSeconds", "Builder name cache", "Advanced", "number", "60", "Seconds to cache builder name plates.", { ...I, min: 1, max: 3600 }),
];

const DEDUPED: Def[] = [];
const seen = new Set<string>();
for (const def of SETTING_DEFS) {
  if (seen.has(def.key)) continue;
  seen.add(def.key);
  DEDUPED.push(def);
}
SETTING_DEFS.length = 0;
SETTING_DEFS.push(...DEDUPED);

export function defaultSettings(): WorldSetting[] {
  return SETTING_DEFS.map((def) => ({ ...def, value: def.defaultValue }));
}

export function mergeSettings(existing: WorldSetting[] | undefined): WorldSetting[] {
  const map = new Map((existing ?? []).map((s) => [s.key, s]));
  return SETTING_DEFS.map((def) => {
    const prev = map.get(def.key);
    return { ...def, value: prev?.value ?? def.defaultValue };
  });
}

export function settingsRecord(settings: WorldSetting[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of settings) out[s.key] = s.value;
  return out;
}

export function groupedSettings(settings: WorldSetting[]): [string, WorldSetting[]][] {
  const g = new Map<string, WorldSetting[]>();
  for (const s of settings) {
    const list = g.get(s.group) ?? [];
    list.push(s);
    g.set(s.group, list);
  }
  return [...g.entries()];
}

export const EDITOR_GROUPS = [
  "General",
  "Combat & difficulty",
  "Pals",
  "Player",
  "Base & building",
  "Items & gathering",
  "Travel & world",
  "Server & multiplayer",
  "Advanced",
] as const;

const KEY_EDITOR_GROUP: Record<string, (typeof EDITOR_GROUPS)[number]> = {
  DayTimeSpeedRate: "General",
  NightTimeSpeedRate: "General",
  ExpRate: "General",
  AutoSaveSpan: "General",
  Difficulty: "General",
  ServerName: "General",
  ServerDescription: "General",
  PlayerDamageRateAttack: "Combat & difficulty",
  PlayerDamageRateDefense: "Combat & difficulty",
  PalDamageRateAttack: "Combat & difficulty",
  PalDamageRateDefense: "Combat & difficulty",
  DeathPenalty: "Combat & difficulty",
  bEnableInvaderEnemy: "Combat & difficulty",
  EnablePredatorBossPal: "Combat & difficulty",
  bHardcore: "Combat & difficulty",
  bPalLost: "Combat & difficulty",
  bIsPvP: "Combat & difficulty",
  PalCaptureRate: "Pals",
  PalSpawnNumRate: "Pals",
  PalStomachDecreaceRate: "Pals",
  PalStaminaDecreaceRate: "Pals",
  PalAutoHPRegeneRate: "Pals",
  PalAutoHpRegeneRateInSleep: "Pals",
  PalEggDefaultHatchingTime: "Pals",
  WorkSpeedRate: "Pals",
  MonsterFarmActionSpeedRate: "Pals",
  PlayerStomachDecreaceRate: "Player",
  PlayerStaminaDecreaceRate: "Player",
  PlayerAutoHPRegeneRate: "Player",
  PlayerAutoHpRegeneRateInSleep: "Player",
  ItemWeightRate: "Player",
  bAllowEnhanceStat_Health: "Player",
  bAllowEnhanceStat_Attack: "Player",
  bAllowEnhanceStat_Stamina: "Player",
  bAllowEnhanceStat_Weight: "Player",
  bAllowEnhanceStat_WorkSpeed: "Player",
  BaseCampMaxNum: "Base & building",
  BaseCampMaxNumInGuild: "Base & building",
  BaseCampWorkerMaxNum: "Base & building",
  MaxBuildingLimitNum: "Base & building",
  BuildObjectHpRate: "Base & building",
  BuildObjectDamageRate: "Base & building",
  BuildObjectDeteriorationDamageRate: "Base & building",
  bBuildAreaLimit: "Base & building",
  CollectionDropRate: "Items & gathering",
  CollectionObjectHpRate: "Items & gathering",
  CollectionObjectRespawnSpeedRate: "Items & gathering",
  EnemyDropItemRate: "Items & gathering",
  DropItemMaxNum: "Items & gathering",
  DropItemAliveMaxHours: "Items & gathering",
  EquipmentDurabilityDamageRate: "Items & gathering",
  ItemCorruptionMultiplier: "Items & gathering",
  bEnableFastTravel: "Travel & world",
  bEnableFastTravelOnlyBaseCamp: "Travel & world",
  bIsStartLocationSelectByMap: "Travel & world",
  SupplyDropSpan: "Travel & world",
  RandomizerType: "Travel & world",
  RandomizerSeed: "Travel & world",
  ServerPlayerMaxNum: "Server & multiplayer",
  CoopPlayerMaxNum: "Server & multiplayer",
  GuildPlayerMaxNum: "Server & multiplayer",
  PublicPort: "Server & multiplayer",
  RESTAPIEnabled: "Server & multiplayer",
  RESTAPIPort: "Server & multiplayer",
  RCONEnabled: "Server & multiplayer",
  RCONPort: "Server & multiplayer",
  ServerPassword: "Server & multiplayer",
  AdminPassword: "Server & multiplayer",
  bAllowClientMod: "Server & multiplayer",
  bEnableVoiceChat: "Server & multiplayer",
};

const GROUP_FALLBACK: Record<string, (typeof EDITOR_GROUPS)[number]> = {
  Identity: "General",
  Rates: "General",
  Damage: "Combat & difficulty",
  Survival: "Player",
  Rules: "Combat & difficulty",
  Population: "Server & multiplayer",
  Network: "Server & multiplayer",
  Drops: "Items & gathering",
  Guilds: "Server & multiplayer",
  Palbox: "Pals",
  PvP: "Combat & difficulty",
  Voice: "Server & multiplayer",
  Stats: "Player",
  Randomizer: "Travel & world",
  Advanced: "Advanced",
};

export function editorGroup(s: WorldSetting): (typeof EDITOR_GROUPS)[number] {
  return KEY_EDITOR_GROUP[s.key] ?? GROUP_FALLBACK[s.group] ?? "Advanced";
}

export function groupedEditorSettings(settings: WorldSetting[]): [string, WorldSetting[]][] {
  const buckets = new Map<string, WorldSetting[]>();
  for (const name of EDITOR_GROUPS) buckets.set(name, []);
  for (const s of settings) {
    const g = editorGroup(s);
    const list = buckets.get(g) ?? [];
    list.push(s);
    buckets.set(g, list);
  }
  return EDITOR_GROUPS.map((name) => [name, buckets.get(name) ?? []] as [string, WorldSetting[]]).filter(([, rows]) => rows.length);
}

export function editedCount(settings: WorldSetting[]) {
  return settings.filter((s) => isEdited(s)).length;
}

export function isEdited(s: WorldSetting) {
  return formatSettingValue(s) !== formatSettingValue({ ...s, value: s.defaultValue });
}

export function formatSettingValue(s: Pick<WorldSetting, "type" | "format" | "value">) {
  if (s.type === "bool") return s.value === "True" || s.value === "true" || s.value === "1" ? "True" : "False";
  if (s.type === "number" && s.format === "float") {
    const n = Number(s.value);
    return Number.isFinite(n) ? n.toFixed(6) : s.value;
  }
  if (s.type === "number" && s.format === "int") {
    const n = Number(s.value);
    return Number.isFinite(n) ? String(Math.trunc(n)) : s.value;
  }
  return s.value;
}

export function settingsToIni(settings: WorldSetting[]) {
  const body = settings
    .map((s) => {
      const value = formatSettingValue(s);
      if (s.type === "string") return `${s.key}="${escapeIni(value)}"`;
      if (s.type === "array") return `${s.key}=(${value})`;
      return `${s.key}=${value}`;
    })
    .join(",");
  return `[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${body})\n`;
}

export function parseOptionSettings(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const match = raw.match(/OptionSettings\s*=\s*\(([\s\S]*)\)\s*$/m) || raw.match(/\(([\s\S]*)\)/);
  const inner = match ? match[1] : raw;
  const parts = splitArgs(inner);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    if (value.startsWith("(") && value.endsWith(")")) value = value.slice(1, -1);
    if (value.startsWith('"') && value.endsWith('"')) value = unescapeIni(value.slice(1, -1));
    if (key) out[key] = value;
  }
  return out;
}

export function applyParsed(settings: WorldSetting[], parsed: Record<string, string>): WorldSetting[] {
  const merged = mergeSettings(settings);
  const known = new Set(merged.map((s) => s.key));
  const next = merged.map((s) => (parsed[s.key] !== undefined ? { ...s, value: parsed[s.key] } : s));
  for (const [key, value] of Object.entries(parsed)) {
    if (known.has(key)) continue;
    next.push({
      key,
      label: key,
      group: "Imported",
      type: guessType(value),
      value,
      defaultValue: value,
      hint: "Key from the imported file. Palnest does not ship a description for it.",
    });
  }
  return next;
}

function guessType(value: string): WorldSetting["type"] {
  if (value === "True" || value === "False") return "bool";
  if (value.includes(",") && !value.includes(" ")) return "array";
  if (value !== "" && Number.isFinite(Number(value))) return "number";
  return "string";
}

function splitArgs(src: string) {
  const parts: string[] = [];
  let buf = "";
  let quoted = false;
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' && src[i - 1] !== "\\") quoted = !quoted;
    if (!quoted) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === "," && depth === 0) {
        if (buf.trim()) parts.push(buf.trim());
        buf = "";
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function escapeIni(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function unescapeIni(value: string) {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}
