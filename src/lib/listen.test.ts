import assert from "node:assert/strict";
import test from "node:test";
import {
  bootListenLines,
  bootWarmupLines,
  denListenMs,
  isListenLine,
  isSlowListenBuild,
  portwarpArgv,
  queryPortArgForced,
  queryPortUdpLikely,
  simulatedListenProbe,
  tunnelAgentArgv,
} from "./listen.ts";

test("older PalServer is a slow listen build; 1.0.4+ is not", () => {
  assert.equal(isSlowListenBuild("0.7.3"), true);
  assert.equal(isSlowListenBuild("1.0.0"), true);
  assert.equal(isSlowListenBuild("1.0.2"), true);
  assert.equal(isSlowListenBuild("1.0.4"), false);
  assert.equal(isSlowListenBuild("1.0.5"), false);
  assert.ok(denListenMs("0.7.3") > denListenMs("1.0.2"));
  assert.ok(denListenMs("1.0.2") > denListenMs("1.0.5"));
});

test("Steam query UDP is not assumed on EA or official 1.0.4+", () => {
  assert.equal(queryPortUdpLikely("0.7.3"), false);
  assert.equal(queryPortUdpLikely("1.0.2"), true);
  assert.equal(queryPortUdpLikely("1.0.4"), false);
  assert.equal(queryPortArgForced("0.7.3"), true);
  assert.equal(queryPortArgForced("1.0.5"), false);
});

test("breakpad and version lines are not listen-ready", () => {
  assert.equal(isListenLine("Setting breakpad minidump AppID = 2394010"), false);
  assert.equal(isListenLine("Game version is v0.7.3.870221"), false);
  assert.equal(isListenLine("[PALNEST] Hollow starting PalServer 0.7.3 — waiting for UDP 8211"), false);
  assert.equal(isListenLine("LogNet: Name: Pal, InitBase: 1"), true);
  assert.equal(isListenLine("Running Palworld dedicated server on :8211"), true);
  assert.equal(isListenLine("[PALNEST] Hollow bound UDP 8211"), true);
});

test("PortWarp argv maps game UDP and only adds query when that port is bound", () => {
  const base = { name: "Hollow Isle", port: 8211, queryPort: 27015, queryBound: false as boolean };
  assert.deepEqual(portwarpArgv(base), ["start", "--udp", "8211"]);
  assert.deepEqual(portwarpArgv({ ...base, queryBound: true }), ["start", "--udp", "8211", "--udp", "27015"]);
  assert.deepEqual(tunnelAgentArgv("playit", base, "C:\\PalServers\\Hollow"), [
    "--secret_path",
    "C:\\PalServers\\Hollow\\playit.toml",
  ]);
});

test("warmup logs do not claim the world is listening", () => {
  const inst = { name: "Ashfall", version: "0.7.3", port: 8211, build: "870221" };
  const warm = bootWarmupLines(inst).join("\n");
  assert.match(warm, /waiting for UDP 8211/);
  assert.ok(!warm.includes("bound UDP"));
  assert.ok(bootListenLines(inst).some((l) => isListenLine(l)));
});

test("simulated probe stays closed until the version's listen delay", () => {
  const startedAt = new Date(Date.now() - 500).toISOString();
  const old = { running: true, startedAt, listenAt: null as string | null, version: "0.7.3" };
  assert.equal(simulatedListenProbe(old).bound, false);
  const later = Date.now() + denListenMs("0.7.3");
  assert.equal(simulatedListenProbe(old, later).bound, true);
  assert.equal(simulatedListenProbe({ ...old, running: false }, later).bound, false);
});
