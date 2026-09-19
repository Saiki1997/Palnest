import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultEngineTweaks,
  groupedEngineTweaks,
  mergeEngineTweaks,
  OPTIMIZE_PRESETS,
  tweaksToIni,
} from "./args.ts";
import { engineIniPath } from "./ops.ts";

test("engine tweaks have unique ids and cover tick/network/memory", () => {
  const tweaks = defaultEngineTweaks();
  const ids = tweaks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["pool", "net", "bandwidth", "gc", "gcparallel", "keepalive", "timeout", "scale", "inet"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  const groups = groupedEngineTweaks(tweaks).map(([label]) => label);
  assert.ok(groups.includes("Tick & frame"));
  assert.ok(groups.includes("Network"));
  assert.ok(groups.includes("Memory & GC"));
});

test("tweaksToIni writes only enabled server keys and scale block", () => {
  const tweaks = defaultEngineTweaks().map((t) =>
    t.id === "scale" || t.id === "net" ? { ...t, enabled: true } : { ...t, enabled: t.id === "far" },
  );
  const ini = tweaksToIni(tweaks, "server");
  assert.ok(ini.includes("[/Script/OnlineSubsystemUtils.IpNetDriver]"));
  assert.ok(ini.includes("NetServerMaxTickRate=30"));
  assert.ok(ini.includes("[ScalabilityGroups]"));
  assert.ok(ini.includes("sg.ShadowQuality=0"));
  assert.ok(!ini.includes("r.ViewDistanceScale"));
  assert.ok(ini.includes("Palworld Server & Mod Manager"));
});

test("mergeEngineTweaks keeps user values and adds new defaults", () => {
  const merged = mergeEngineTweaks([
    {
      id: "net",
      section: "old",
      key: "NetServerMaxTickRate",
      value: "60",
      enabled: false,
      hint: "old",
      target: "server",
    },
  ]);
  const net = merged.find((t) => t.id === "net");
  assert.equal(net?.value, "60");
  assert.equal(net?.enabled, false);
  assert.equal(net?.section, "/Script/OnlineSubsystemUtils.IpNetDriver");
  assert.ok(merged.find((t) => t.id === "keepalive"));
  assert.ok(merged.find((t) => t.id === "scale"));
});

test("performance presets only reference known tweak ids", () => {
  const ids = new Set(defaultEngineTweaks().map((t) => t.id));
  for (const preset of OPTIMIZE_PRESETS) {
    for (const key of Object.keys(preset.tweaks)) {
      assert.ok(ids.has(key), `${preset.id} unknown tweak ${key}`);
    }
  }
  const perf = OPTIMIZE_PRESETS.find((p) => p.id === "perf");
  assert.ok(perf?.stackable);
  assert.equal(perf?.tweaks.gcparallel, true);
  assert.equal(perf?.tweaks.scale, true);
});

test("engine.ini path sits next to PalWorldSettings.ini", () => {
  const path = engineIniPath("C:\\PalServers\\HollowIsle");
  assert.ok(path.endsWith("WindowsServer\\Engine.ini"));
  assert.ok(engineIniPath("/opt/pal", true).includes("LinuxServer"));
});
