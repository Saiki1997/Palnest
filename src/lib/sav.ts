import type { SavKind, WorldSetting, WorldSnapshot } from "./types.ts";
import { SETTING_DEFS, settingsRecord } from "./ini.ts";

const GVAS_MAGIC = 0x53415647;
const SAVE_GAME_VERSION = 3;
const PACKAGE_UE4 = 522;
const PACKAGE_UE5 = 1008;
const CLASS_WORLD_OPTION = "/Script/Pal.PalWorldOptionSaveGame";
const CLASS_WORLD = "/Script/Pal.PalWorldSaveGame";
const CLASS_LOCAL_WORLD = "/Script/Pal.PalLocalWorldSaveGame";
const CLASS_META = "/Script/Pal.PalWorldBaseInfoSaveGame";
const CLASS_META_LEGACY = "/Script/Pal.PalWorldMetaSaveGame";
const ZERO_GUID = "00000000-0000-0000-0000-000000000000";
const UNIX_TO_UNREAL_TICKS = 621355968000000000n;

const CUSTOM_FORMAT: [string, number][] = [
  ["40d2fba7-4b48-4ce5-b038-5a75884e499e", 7],
  ["fcf57afa-5076-4283-b9a9-e658ffa02d32", 76],
  ["0925477b-763d-4001-9d91-d6730b75b411", 1],
  ["4288211b-4548-16c6-1a76-67b2507a2a00", 1],
  ["1ab9cecc-0000-6913-0000-4875203d51fb", 100],
  ["4cef9221-470e-d43a-7e60-3d8c16995726", 1],
  ["e2717c7e-52f5-44d3-950c-5340b315035e", 7],
  ["11310aed-2e55-4d61-af67-9aa3c5a1082c", 17],
  ["a7820cfb-20a7-4359-8c54-2c149623cf50", 21],
  ["f6dfbb78-bb50-a0e4-4018-b84d60cbaf23", 2],
  ["24bb7af3-5646-4f83-1f2f-2dc249ad96ff", 5],
  ["76a52329-0923-45b5-98ae-d841cf2f6ad8", 5],
  ["5fbc6907-55c8-40ae-8e67-f1845efff13f", 1],
  ["82e77c4e-3323-43a5-b46b-13c597310df3", 0],
  ["0ffcf66c-1190-4899-b160-9cf84a46475e", 1],
  ["9c54d522-a826-4fbe-9421-074661b482d0", 44],
  ["b0d832e4-1f89-4f0d-accf-7eb736fd4aa2", 10],
  ["e1c64328-a22c-4d53-a36c-8e866417bd8c", 0],
  ["375ec13c-06e4-48fb-b500-84f0262a717e", 4],
  ["e4b068ed-f494-42e9-a231-da0b2e46bb41", 40],
  ["cffc743f-43b0-4480-9391-14df171d2073", 37],
  ["b02b49b5-bb20-44e9-a304-32b752e40360", 3],
  ["a4e4105c-59a1-49b5-a7c5-40c4547edfee", 0],
  ["39c831c9-5ae6-47dc-9a44-9c173e1c8e7c", 0],
  ["78f01b33-ebea-4f98-b9b4-84eaccb95aa2", 20],
  ["6631380f-2d4d-43e0-8009-cf276956a95a", 0],
  ["12f88b9f-8875-4afc-a67c-d90c383abd29", 45],
  ["7b5ae74c-d270-4c10-a958-57980b212a5a", 13],
  ["d7296918-1dd6-4bdd-9de2-64a83cc13884", 3],
  ["c2a15278-bfe7-4afe-6c17-90ff531df755", 1],
  ["6eaca3d4-40ec-4cc1-b786-8bed09428fc5", 3],
  ["29e575dd-e0a3-4627-9d10-d276232cdcea", 17],
  ["af43a65d-7fd3-4947-9873-3e8ed9c1bb05", 15],
  ["6b266cec-1ec7-4b8f-a30b-e4d90942fc07", 1],
  ["0df73d61-a23f-47ea-b727-89e90c41499a", 1],
  ["601d1886-ac64-4f84-aa16-d3de0deac7d6", 80],
  ["5b4c06b7-2463-4af8-805b-bf70cdf5d0dd", 10],
  ["e7086368-6b23-4c58-8439-1b7016265e91", 4],
  ["9dffbcd6-494f-0158-e221-12823c92a888", 10],
  ["f2aed0ac-9afe-416f-8664-aa7ffa26d6fc", 1],
  ["174f1f0b-b4c6-45a5-b13f-2ee8d0fb917d", 10],
  ["35f94a83-e258-406c-a318-09f59610247c", 41],
  ["b68fc16e-8b1b-42e2-b453-215c058844fe", 1],
  ["b2e18506-4273-cfc2-a54e-f4bb758bba07", 1],
  ["64f58936-fd1b-42ba-ba96-7289d5d0fa4e", 1],
  ["697dd581-e64f-41ab-aa4a-51ecbeb7b628", 88],
  ["d89b5e42-24bd-4d46-8412-aca8df641779", 41],
  ["59da5d52-1232-4948-b878-597870b8e98b", 8],
  ["26075a32-730f-4708-88e9-8c32f1599d05", 0],
  ["6f0ed827-a609-4895-9c91-998d90180ea4", 2],
  ["30d58be3-95ea-4282-a6e3-b159d8ebb06a", 1],
  ["717f9ee7-e9b0-493a-88b3-91321b388107", 16],
  ["430c4d19-7154-4970-8769-9b69df90b0e5", 15],
  ["aafe32bd-5395-4c14-b66a-5e251032d1dd", 1],
  ["23afe18e-4ce1-4e58-8d61-c252b953beb7", 11],
  ["a462b7ea-f499-4e3a-99c1-ec1f8224e1b2", 4],
  ["2eb5fdbd-01ac-4d10-8136-f38f3393a5da", 5],
  ["509d354f-f6e6-492f-a749-85b2073c631c", 0],
  ["b6e31b1c-d29f-11ec-857e-9f856f9970e2", 1],
  ["4a56eb40-10f5-11dc-92d3-347eb2c96ae7", 2],
  ["d78a4a00-e858-4697-baa8-19b5487d46b4", 18],
  ["5579f886-933a-4c1f-83ba-087b6361b92f", 2],
  ["612fbe52-da53-400b-910d-4f919fb1857c", 1],
  ["a4237a36-caea-41c9-8fa2-18f858681bf3", 5],
  ["804e3f75-7088-4b49-a4d6-8c063c7eb6dc", 5],
  ["1ed048f4-2f2e-4c68-89d0-53a4f18f102d", 1],
  ["fb680af2-59ef-4ba3-baa8-19b573c8443d", 2],
  ["9950b70e-b41a-4e17-bbcc-fa0d57817fd6", 1],
  ["ab965196-45d8-08fc-b7d7-228d78ad569e", 1],
];

export interface SavReport {
  kind: SavKind;
  className: string;
  compression: "plz" | "plm" | "none" | "unknown";
  uncompressed: number;
  settings: Record<string, string>;
  strings: string[];
  note: string;
  meta?: WorldMeta;
}

export interface WorldMeta {
  worldName?: string;
  hostPlayerName?: string;
  hostPlayerLevel?: number;
  inGameDay?: number;
}

class Writer {
  buf = new Uint8Array(2048);
  off = 0;

  ensure(n: number) {
    if (this.off + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.off + n));
    next.set(this.buf);
    this.buf = next;
  }

  write(bytes: Uint8Array) {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.off);
    this.off += bytes.length;
  }

  u8(n: number) {
    this.ensure(1);
    this.buf[this.off++] = n & 0xff;
  }

  bool(v: boolean) {
    this.u8(v ? 1 : 0);
  }

  i32(n: number) {
    this.ensure(4);
    new DataView(this.buf.buffer).setInt32(this.off, n, true);
    this.off += 4;
  }

  u32(n: number) {
    this.ensure(4);
    new DataView(this.buf.buffer).setUint32(this.off, n, true);
    this.off += 4;
  }

  u16(n: number) {
    this.ensure(2);
    new DataView(this.buf.buffer).setUint16(this.off, n, true);
    this.off += 2;
  }

  u64(n: number | bigint) {
    this.ensure(8);
    new DataView(this.buf.buffer).setBigUint64(this.off, BigInt(n), true);
    this.off += 8;
  }

  i64(n: number | bigint) {
    this.ensure(8);
    new DataView(this.buf.buffer).setBigInt64(this.off, BigInt(n), true);
    this.off += 8;
  }

  f32(n: number) {
    this.ensure(4);
    new DataView(this.buf.buffer).setFloat32(this.off, n, true);
    this.off += 4;
  }

  fstring(s: string) {
    const start = this.off;
    if (!s) {
      this.i32(0);
      return this.off - start;
    }
    let ascii = true;
    for (let i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 127) {
        ascii = false;
        break;
      }
    }
    if (ascii) {
      this.i32(s.length + 1);
      this.ensure(s.length + 1);
      for (let i = 0; i < s.length; i++) this.buf[this.off++] = s.charCodeAt(i);
      this.u8(0);
    } else {
      this.i32(-(s.length + 1));
      this.ensure((s.length + 1) * 2);
      for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        this.buf[this.off++] = c & 0xff;
        this.buf[this.off++] = c >> 8;
      }
      this.u8(0);
      this.u8(0);
    }
    return this.off - start;
  }

  guid(uuid: string) {
    this.write(uuidToUnreal(uuid));
  }

  optionalGuid(uuid?: string | null) {
    if (!uuid) this.bool(false);
    else {
      this.bool(true);
      this.guid(uuid);
    }
  }

  bytes() {
    return this.buf.slice(0, this.off);
  }
}

class Reader {
  buf: Uint8Array;
  off: number;
  constructor(buf: Uint8Array, off = 0) {
    this.buf = buf;
    this.off = off;
  }

  remaining() {
    return this.buf.length - this.off;
  }

  u8() {
    return this.buf[this.off++];
  }

  bool() {
    return this.u8() !== 0;
  }

  view() {
    return new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
  }

  i32() {
    const n = this.view().getInt32(this.off, true);
    this.off += 4;
    return n;
  }

  u32() {
    const n = this.view().getUint32(this.off, true);
    this.off += 4;
    return n;
  }

  u16() {
    const n = this.view().getUint16(this.off, true);
    this.off += 2;
    return n;
  }

  u64() {
    const n = this.view().getBigUint64(this.off, true);
    this.off += 8;
    return n;
  }

  f32() {
    const n = this.view().getFloat32(this.off, true);
    this.off += 4;
    return n;
  }

  skip(n: number) {
    this.off += n;
  }

  raw(n: number) {
    const slice = this.buf.subarray(this.off, this.off + n);
    this.off += n;
    return slice;
  }

  fstring() {
    const len = this.i32();
    if (len === 0) return "";
    if (len > 0) {
      const bytes = this.raw(len);
      return new TextDecoder("latin1").decode(bytes.subarray(0, Math.max(0, len - 1)));
    }
    const chars = -len;
    const bytes = this.raw(chars * 2);
    return new TextDecoder("utf-16le").decode(bytes.subarray(0, Math.max(0, (chars - 1) * 2)));
  }

  guid() {
    return unrealToUuid(this.raw(16));
  }

  optionalGuid() {
    if (!this.bool()) return null;
    return this.guid();
  }
}

function uuidToUnreal(uuid: string): Uint8Array {
  const h = uuid.replace(/-/g, "");
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return new Uint8Array([
    b[3], b[2], b[1], b[0],
    b[7], b[6], b[5], b[4],
    b[11], b[10], b[9], b[8],
    b[15], b[14], b[13], b[12],
  ]);
}

function unrealToUuid(b: Uint8Array) {
  const s = [
    b[3], b[2], b[1], b[0],
    b[7], b[6], b[5], b[4],
    b[11], b[10], b[9], b[8],
    b[15], b[14], b[13], b[12],
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

type Prop =
  | { type: "IntProperty"; value: number }
  | { type: "FloatProperty"; value: number }
  | { type: "BoolProperty"; value: boolean }
  | { type: "StrProperty"; value: string }
  | { type: "NameProperty"; value: string }
  | { type: "EnumProperty"; value: { type: string; value: string } }
  | { type: "ArrayProperty"; array_type: string; value: { values: string[] } }
  | { type: "StructProperty"; struct_type: string; struct_id: string; value: Record<string, Prop>; ticks?: bigint };

function jsToUnrealTicks(date = new Date()) {
  return BigInt(date.getTime()) * 10000n + UNIX_TO_UNREAL_TICKS;
}

function writeProperty(w: Writer, prop: Prop) {
  const inner = new Writer();
  let size = 0;
  if (prop.type === "IntProperty") {
    inner.optionalGuid(null);
    inner.i32(prop.value);
    size = 4;
  } else if (prop.type === "FloatProperty") {
    inner.optionalGuid(null);
    inner.f32(prop.value);
    size = 4;
  } else if (prop.type === "BoolProperty") {
    inner.bool(prop.value);
    inner.optionalGuid(null);
    size = 0;
  } else if (prop.type === "StrProperty" || prop.type === "NameProperty") {
    inner.optionalGuid(null);
    size = inner.fstring(prop.value);
  } else if (prop.type === "EnumProperty") {
    inner.fstring(prop.value.type);
    inner.optionalGuid(null);
    size = inner.fstring(prop.value.value);
  } else if (prop.type === "ArrayProperty") {
    inner.fstring(prop.array_type);
    inner.optionalGuid(null);
    const arr = new Writer();
    arr.u32(prop.value.values.length);
    for (const v of prop.value.values) arr.fstring(v);
    const bytes = arr.bytes();
    size = bytes.length;
    inner.write(bytes);
  } else if (prop.type === "StructProperty") {
    inner.fstring(prop.struct_type);
    inner.guid(prop.struct_id);
    inner.optionalGuid(null);
    if (prop.struct_type === "DateTime") {
      inner.u64(prop.ticks ?? jsToUnrealTicks());
      size = 8;
    } else {
      const start = inner.off;
      writeProperties(inner, prop.value);
      size = inner.off - start;
    }
  }
  w.fstring(prop.type);
  w.u64(size);
  w.write(inner.bytes());
}

function writeProperties(w: Writer, props: Record<string, Prop>) {
  for (const [key, prop] of Object.entries(props)) {
    w.fstring(key);
    writeProperty(w, prop);
  }
  w.fstring("None");
}

function readProperties(r: Reader): Record<string, Prop> {
  const out: Record<string, Prop> = {};
  while (r.remaining() > 4) {
    const name = r.fstring();
    if (name === "None" || !name) break;
    out[name] = readProperty(r);
  }
  return out;
}

function readProperty(r: Reader): Prop {
  const type = r.fstring();
  r.u64();
  if (type === "IntProperty") {
    r.optionalGuid();
    return { type, value: r.i32() };
  }
  if (type === "FloatProperty") {
    r.optionalGuid();
    return { type, value: r.f32() };
  }
  if (type === "BoolProperty") {
    const value = r.bool();
    r.optionalGuid();
    return { type, value };
  }
  if (type === "StrProperty" || type === "NameProperty") {
    r.optionalGuid();
    return { type, value: r.fstring() } as Prop;
  }
  if (type === "EnumProperty") {
    const enumType = r.fstring();
    r.optionalGuid();
    return { type, value: { type: enumType, value: r.fstring() } };
  }
  if (type === "ArrayProperty") {
    const arrayType = r.fstring();
    r.optionalGuid();
    const count = r.u32();
    const values: string[] = [];
    for (let i = 0; i < count; i++) values.push(r.fstring());
    return { type, array_type: arrayType, value: { values } };
  }
  if (type === "StructProperty") {
    const structType = r.fstring();
    const structId = r.guid();
    r.optionalGuid();
    if (structType === "DateTime") {
      const ticks = r.u64();
      return { type, struct_type: structType, struct_id: structId, value: {}, ticks };
    }
    return { type, struct_type: structType, struct_id: structId, value: readProperties(r) };
  }
  throw new Error(`Unsupported property ${type}`);
}

function settingToProp(s: WorldSetting): Prop {
  const value = s.value;
  if (s.type === "bool") return { type: "BoolProperty", value: value === "True" || value === "true" || value === "1" };
  if (s.type === "string") return { type: "StrProperty", value };
  if (s.type === "enum") {
    const enumType = s.enumType || "Enum";
    return { type: "EnumProperty", value: { type: enumType, value: `${enumType}::${value}` } };
  }
  if (s.type === "array") {
    const enumType = s.enumType || "EPalAllowConnectPlatform";
    const values = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => `${enumType}::${v}`);
    return { type: "ArrayProperty", array_type: "EnumProperty", value: { values } };
  }
  if (s.format === "int") return { type: "IntProperty", value: Number.parseInt(value, 10) || 0 };
  return { type: "FloatProperty", value: Number(value) || 0 };
}

function propToString(prop: Prop): string | null {
  if (prop.type === "BoolProperty") return prop.value ? "True" : "False";
  if (prop.type === "IntProperty") return String(prop.value);
  if (prop.type === "FloatProperty") {
    const n = prop.value;
    return Number.isInteger(n) ? n.toFixed(6) : String(Number(n.toFixed(6)));
  }
  if (prop.type === "StrProperty" || prop.type === "NameProperty") return prop.value;
  if (prop.type === "EnumProperty") {
    const v = prop.value.value;
    const idx = v.lastIndexOf("::");
    return idx >= 0 ? v.slice(idx + 2) : v;
  }
  if (prop.type === "ArrayProperty") {
    return prop.value.values
      .map((v) => {
        const idx = v.lastIndexOf("::");
        return idx >= 0 ? v.slice(idx + 2) : v;
      })
      .join(",");
  }
  return null;
}

function writeGvas(className: string, properties: Record<string, Prop>) {
  const w = new Writer();
  w.i32(GVAS_MAGIC);
  w.i32(SAVE_GAME_VERSION);
  w.i32(PACKAGE_UE4);
  w.i32(PACKAGE_UE5);
  w.u16(5);
  w.u16(1);
  w.u16(1);
  w.u32(0);
  w.fstring("++UE5+Release-5.1");
  w.i32(3);
  w.u32(CUSTOM_FORMAT.length);
  for (const [id, ver] of CUSTOM_FORMAT) {
    w.guid(id);
    w.i32(ver);
  }
  w.fstring(className);
  writeProperties(w, properties);
  w.i32(0);
  return w.bytes();
}

function readGvasHeader(r: Reader) {
  const magic = r.i32();
  if (magic !== GVAS_MAGIC) throw new Error("Not a GVAS save");
  r.i32();
  r.i32();
  r.i32();
  r.u16();
  r.u16();
  r.u16();
  r.u32();
  r.fstring();
  r.i32();
  const count = r.u32();
  for (let i = 0; i < count; i++) {
    r.skip(16);
    r.i32();
  }
  return r.fstring();
}

async function zlib(data: Uint8Array, mode: "deflate" | "inflate") {
  const Ctor = mode === "deflate" ? CompressionStream : DecompressionStream;
  const stream = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer])
    .stream()
    .pipeThrough(new Ctor("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function compressGvas(gvas: Uint8Array, saveType: 0x31 | 0x32 = 0x31) {
  let packed = await zlib(gvas, "deflate");
  const compressedLen = packed.length;
  if (saveType === 0x32) packed = await zlib(packed, "deflate");
  const out = new Uint8Array(12 + packed.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, gvas.length, true);
  view.setUint32(4, compressedLen, true);
  out[8] = 0x50; // P
  out[9] = 0x6c; // l
  out[10] = 0x5a; // Z
  out[11] = saveType;
  out.set(packed, 12);
  return out;
}

export async function decompressSav(bytes: Uint8Array): Promise<{ gvas: Uint8Array; saveType: number; magic: string }> {
  if (bytes.length < 12) throw new Error("File is too small to be a Palworld save.");
  let uncompressedLen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  let compressedLen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, true);
  let magic = String.fromCharCode(bytes[8], bytes[9], bytes[10]);
  let saveType = bytes[11];
  let start = 12;
  if (magic === "CNK") {
    uncompressedLen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true);
    compressedLen = new DataView(bytes.buffer, bytes.byteOffset).getUint32(16, true);
    magic = String.fromCharCode(bytes[20], bytes[21], bytes[22]);
    saveType = bytes[23];
    start = 24;
  }
  if (magic === "PlM") {
    const err = new Error("Oodle");
    (err as Error & { code?: string }).code = "PLM";
    throw err;
  }
  if (magic !== "PlZ") throw new Error(`Not a Palworld save (found ${magic || "no magic"}).`);
  if (saveType !== 0x31 && saveType !== 0x32) throw new Error(`Unhandled compression 0x${saveType.toString(16)}`);
  let data = await zlib(bytes.subarray(start), "inflate");
  if (saveType === 0x32) {
    if (data.length !== compressedLen) {
      // still try
    }
    data = await zlib(data, "inflate");
  }
  if (uncompressedLen && data.length !== uncompressedLen) {
    // keep going; some tools write a stale length
  }
  return { gvas: data, saveType, magic };
}

export async function encodeWorldOptionSav(settings: WorldSetting[]): Promise<Uint8Array> {
  const fields: Record<string, Prop> = {};
  for (const s of settings) fields[s.key] = settingToProp(s);
  const gvas = writeGvas(CLASS_WORLD_OPTION, {
    Version: { type: "IntProperty", value: 100 },
    OptionWorldData: {
      type: "StructProperty",
      struct_type: "PalOptionWorldSaveData",
      struct_id: ZERO_GUID,
      value: {
        Settings: {
          type: "StructProperty",
          struct_type: "PalOptionWorldSettings",
          struct_id: ZERO_GUID,
          value: fields,
        },
      },
    },
  });
  return compressGvas(gvas, 0x31);
}

export async function encodeLevelMetaSav(input: {
  worldName: string;
  hostPlayerName?: string;
  hostPlayerLevel?: number;
  inGameDay?: number;
}): Promise<Uint8Array> {
  const gvas = writeGvas(CLASS_META, {
    Version: { type: "IntProperty", value: 100 },
    Timestamp: {
      type: "StructProperty",
      struct_type: "DateTime",
      struct_id: ZERO_GUID,
      value: {},
      ticks: jsToUnrealTicks(),
    },
    SaveData: {
      type: "StructProperty",
      struct_type: "PalWorldBaseInfoSaveData",
      struct_id: ZERO_GUID,
      value: {
        WorldName: { type: "StrProperty", value: input.worldName },
        HostPlayerName: { type: "StrProperty", value: input.hostPlayerName ?? "" },
        HostPlayerLevel: { type: "IntProperty", value: input.hostPlayerLevel ?? 1 },
        InGameDay: { type: "IntProperty", value: input.inGameDay ?? 1 },
      },
    },
  });
  return compressGvas(gvas, 0x31);
}

function flattenMeta(props: Record<string, Prop>): WorldMeta {
  const save = props.SaveData;
  if (!save || save.type !== "StructProperty") return {};
  const worldName = save.value.WorldName ? (propToString(save.value.WorldName) ?? undefined) : undefined;
  const hostPlayerName = save.value.HostPlayerName ? (propToString(save.value.HostPlayerName) ?? undefined) : undefined;
  const hostLevel = save.value.HostPlayerLevel;
  const day = save.value.InGameDay;
  return {
    worldName,
    hostPlayerName,
    hostPlayerLevel: hostLevel?.type === "IntProperty" ? hostLevel.value : undefined,
    inGameDay: day?.type === "IntProperty" ? day.value : undefined,
  };
}

function flattenSettings(props: Record<string, Prop>): Record<string, string> {
  const option = props.OptionWorldData;
  if (!option || option.type !== "StructProperty") return {};
  const settings = option.value.Settings;
  if (!settings || settings.type !== "StructProperty") return {};
  const out: Record<string, string> = {};
  for (const [key, prop] of Object.entries(settings.value)) {
    const v = propToString(prop);
    if (v !== null) out[key] = v;
  }
  return out;
}

function harvestStrings(buf: Uint8Array) {
  const out: string[] = [];
  const seen = new Set<string>();
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let i = 0; i < buf.length - 8; i++) {
    const len = view.getInt32(i, true);
    if (len >= 4 && len <= 64 && i + 4 + len <= buf.length && buf[i + 3 + len] === 0) {
      let ok = true;
      let s = "";
      for (let k = 0; k < len - 1; k++) {
        const c = buf[i + 4 + k];
        if (c < 32 || c > 126) {
          ok = false;
          break;
        }
        s += String.fromCharCode(c);
      }
      if (ok && /[A-Za-z]/.test(s) && !seen.has(s)) {
        seen.add(s);
        out.push(s);
      }
    }
  }
  return out.slice(0, 40);
}

function kindFromClass(className: string, fileName: string): SavKind {
  const lower = fileName.toLowerCase();
  if (className === CLASS_WORLD_OPTION || className.includes("PalWorldOptionSaveGame") || lower.includes("worldoption")) {
    return "worldoption";
  }
  if (
    className === CLASS_META ||
    className === CLASS_META_LEGACY ||
    className.includes("PalWorldBaseInfo") ||
    className.includes("PalWorldMetaSaveGame") ||
    lower.includes("levelmeta")
  ) {
    return "meta";
  }
  if (
    className === CLASS_WORLD ||
    className === CLASS_LOCAL_WORLD ||
    className.includes("PalWorldSaveGame") ||
    className.includes("PalLocalWorldSaveGame") ||
    lower === "level.sav" ||
    lower === "world.sav"
  ) {
    return lower.includes("player") ? "player" : "level";
  }
  if (lower.includes("player")) return "player";
  if (lower.endsWith(".json")) return "snapshot";
  return "unknown";
}

export async function inspectSav(bytes: Uint8Array, fileName = "World.sav"): Promise<SavReport> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    const text = new TextDecoder().decode(bytes);
    const snap = parseWorldSnapshot(text);
    return {
      kind: "snapshot",
      className: "palnest-snapshot",
      compression: "none",
      uncompressed: bytes.length,
      settings: snap?.settings ?? {},
      strings: snap?.players.map((p) => p.name) ?? [],
      note: "Palnest world snapshot. Players, guilds, and settings were loaded.",
    };
  }

  try {
    const { gvas, magic } = await decompressSav(bytes);
    const r = new Reader(gvas);
    let className = "";
    let settings: Record<string, string> = {};
    let meta: WorldMeta | undefined;
    try {
      className = readGvasHeader(r);
      const props = readProperties(r);
      settings = flattenSettings(props);
      meta = flattenMeta(props);
      if (!Object.keys(meta).length) meta = undefined;
    } catch {
      className = "";
    }
    const kind = kindFromClass(className, fileName);
    const strings = harvestStrings(gvas).filter((s) => !s.startsWith("/") && !s.includes("Property") && s.length < 40);
    const note =
      kind === "worldoption"
        ? "WorldOption.sav. These values override PalWorldSettings.ini for this world."
        : kind === "level"
          ? "World save (Level.sav / World.sav). Settings live in WorldOption.sav; players and guilds are edited in the snapshot below."
          : kind === "meta"
            ? "LevelMeta.sav. World name and in-game day were loaded."
            : "Palworld save unpacked. Unknown keys were left untouched.";
    return {
      kind,
      className,
      compression: magic === "PlZ" ? "plz" : "unknown",
      uncompressed: gvas.length,
      settings,
      strings,
      note,
      meta,
    };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "PLM") {
      return {
        kind: kindFromClass("", fileName),
        className: "",
        compression: "plm",
        uncompressed: bytes.length,
        settings: {},
        strings: [],
        note: "This world save is PlM (Oodle) from Palworld 1.0. Palnest cannot unpack the map, but you can still edit WorldOption.sav and the player / guild snapshot.",
      };
    }
    throw err;
  }
}

export function parseWorldSnapshot(text: string): WorldSnapshot | null {
  try {
    const json = JSON.parse(text) as Partial<WorldSnapshot>;
    if (json?.kind !== "world-snapshot" || json.palnest !== 1) return null;
    return json as WorldSnapshot;
  } catch {
    return null;
  }
}

export function snapshotToJson(snapshot: WorldSnapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function worldOptionPath(serverRoot: string, guid: string) {
  const base = serverRoot || "%SERVER%";
  return `${base}\\Pal\\Saved\\SaveGames\\0\\${guid}\\WorldOption.sav`;
}

export function iniPath(serverRoot: string, linux = false) {
  const base = serverRoot || "%SERVER%";
  const plat = linux ? "LinuxServer" : "WindowsServer";
  return `${base}\\Pal\\Saved\\Config\\${plat}\\PalWorldSettings.ini`;
}

export function levelSavPath(serverRoot: string, guid: string) {
  const base = serverRoot || "%SERVER%";
  return `${base}\\Pal\\Saved\\SaveGames\\0\\${guid}\\Level.sav`;
}

export function levelMetaPath(serverRoot: string, guid: string) {
  const base = serverRoot || "%SERVER%";
  return `${base}\\Pal\\Saved\\SaveGames\\0\\${guid}\\LevelMeta.sav`;
}

export function knownSettingKeys() {
  return SETTING_DEFS.map((d) => d.key);
}

export function settingsFromReport(report: SavReport) {
  return report.settings;
}

export function recordFromSettings(settings: WorldSetting[]) {
  return settingsRecord(settings);
}
