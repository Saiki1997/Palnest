import { settingsToIni } from "./ini.ts";
import { encodeLevelMetaSav, encodeWorldOptionSav, snapshotToJson } from "./sav.ts";
import type { SaveGuild, SavePlayer, WorldInfo, WorldSetting, WorldSnapshot } from "./types.ts";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d = new Date()) {
  const time =
    ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((Math.floor(d.getSeconds() / 2) || 0) & 0x1f);
  const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
  return { time, date };
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const { time, date } = dosDateTime();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array(30 + nameBytes.length + file.data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, file.data.length, true);
    lv.setUint32(22, file.data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(file.data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, file.data.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }

  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + cdSize + eocd.length);
  let p = 0;
  for (const chunk of locals) {
    out.set(chunk, p);
    p += chunk.length;
  }
  for (const chunk of centrals) {
    out.set(chunk, p);
    p += chunk.length;
  }
  out.set(eocd, p);
  return out;
}

export function slugFile(name: string) {
  const s = name
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "world";
}

export interface WorldPackInput {
  settings: WorldSetting[];
  world: Pick<WorldInfo, "id" | "name" | "guid" | "days" | "sizeMb">;
  optionOverride: boolean;
  players: SavePlayer[];
  guilds: SaveGuild[];
  hostPlayerName?: string;
  hostPlayerLevel?: number;
  serverRoot?: string;
}

export interface WorldPackFile {
  name: string;
  data: Uint8Array;
  kind: "ini" | "sav" | "json" | "text";
}

export interface WorldPack {
  files: WorldPackFile[];
  zip: Uint8Array;
  zipName: string;
  snapshot: WorldSnapshot;
  iniText: string;
}

function textBytes(text: string) {
  return new TextEncoder().encode(text);
}

export function worldPackReadme(input: WorldPackInput) {
  const root = input.serverRoot || "%SERVER%";
  const guid = input.world.guid || "<WorldID>";
  return [
    `Palnest world files — ${input.world.name}`,
    "",
    "Stop PalServer before replacing anything. Restart after.",
    "",
    "PalWorldSettings.ini",
    `  ${root}\\Pal\\Saved\\Config\\WindowsServer\\PalWorldSettings.ini`,
    "  Linux: Config\\LinuxServer\\PalWorldSettings.ini",
    "  Server name, passwords, ports, and new-world defaults.",
    "",
    "WorldOption.sav  (what people often call World.sav settings)",
    `  ${root}\\Pal\\Saved\\SaveGames\\0\\${guid}\\WorldOption.sav`,
    "  Existing worlds read this and ignore most INI gameplay keys.",
    "  Delete it if you want PalWorldSettings.ini to apply instead.",
    "",
    "LevelMeta.sav",
    `  ${root}\\Pal\\Saved\\SaveGames\\0\\${guid}\\LevelMeta.sav`,
    "  World name and in-game day shown in the world list.",
    "",
    "World.sav.json",
    "  Palnest snapshot of players and guilds. Not a dedicated Level.sav.",
    "  Do not drop this on top of Level.sav.",
    "",
    "Level.sav is the map. Palnest does not rewrite it (Palworld 1.0 uses Oodle).",
  ].join("\n");
}

export async function buildWorldFilePack(input: WorldPackInput): Promise<WorldPack> {
  const iniText = settingsToIni(input.settings);
  const host = input.players.find((p) => p.name) ?? input.players[0];
  const [worldOption, levelMeta] = await Promise.all([
    encodeWorldOptionSav(input.settings),
    encodeLevelMetaSav({
      worldName: input.world.name,
      hostPlayerName: input.hostPlayerName ?? host?.name ?? "",
      hostPlayerLevel: input.hostPlayerLevel ?? host?.level ?? 1,
      inGameDay: input.world.days,
    }),
  ]);
  const snapshot: WorldSnapshot = {
    palnest: 1,
    kind: "world-snapshot",
    world: {
      id: input.world.id,
      name: input.world.name,
      guid: input.world.guid,
      days: input.world.days,
      sizeMb: input.world.sizeMb,
    },
    optionOverride: input.optionOverride,
    settings: Object.fromEntries(input.settings.map((s) => [s.key, s.value])),
    players: input.players,
    guilds: input.guilds,
  };
  const snapshotText = snapshotToJson(snapshot);
  const readme = worldPackReadme(input);
  const files: WorldPackFile[] = [
    { name: "PalWorldSettings.ini", data: textBytes(iniText), kind: "ini" },
    { name: "WorldOption.sav", data: worldOption, kind: "sav" },
    { name: "LevelMeta.sav", data: levelMeta, kind: "sav" },
    { name: "World.sav.json", data: textBytes(snapshotText), kind: "json" },
    { name: "README.txt", data: textBytes(readme), kind: "text" },
  ];
  return {
    files,
    zip: zipStore(files.map(({ name, data }) => ({ name, data }))),
    zipName: `${slugFile(input.world.name)}-world-files.zip`,
    snapshot,
    iniText,
  };
}
