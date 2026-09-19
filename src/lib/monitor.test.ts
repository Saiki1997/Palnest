import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendSample,
  buildPulse,
  DEFAULT_THRESHOLDS,
  diskForecast,
  downsample,
  evaluateAlerts,
  filterRange,
  parseWorldClock,
  projectDisk,
  sampleAt,
  seedHistory,
  settingOn,
} from "./monitor.ts";

test("parseWorldClock reads saved day and clock, not uptime", () => {
  assert.deepEqual(parseWorldClock("Day 118 · 14:20", 0), { day: 118, clock: "14:20" });
  assert.deepEqual(parseWorldClock("Day 3 • 09:05", 9), { day: 3, clock: "09:05" });
  assert.deepEqual(parseWorldClock(undefined, 7), { day: 7, clock: "08:00" });
});

test("sampleAt idle has no process or REST fps", () => {
  const s = sampleAt(1_700_000_000_000, { running: false, players: 12, worldMb: 1840, restOn: true });
  assert.equal(s.procCpu, 0);
  assert.equal(s.procRamGb, 0);
  assert.equal(s.fps, null);
  assert.equal(s.players, 0);
});

test("sampleAt REST-gated fps only when REST is on", () => {
  const off = sampleAt(1, { running: true, players: 4, worldMb: 100, restOn: false });
  const on = sampleAt(1, { running: true, players: 4, worldMb: 100, restOn: true });
  assert.equal(off.fps, null);
  assert.equal(off.frameMs, null);
  assert.ok(on.fps != null && on.fps > 8);
  assert.ok(on.frameMs != null);
});

test("appendSample skips ticks closer than 2.5s", () => {
  const a = sampleAt(1000, { running: true, players: 1, worldMb: 10, restOn: false });
  const b = sampleAt(2000, { running: true, players: 1, worldMb: 10, restOn: false });
  const c = sampleAt(4000, { running: true, players: 1, worldMb: 10, restOn: false });
  const once = appendSample([a], b);
  assert.equal(once.length, 1);
  const twice = appendSample([a], c);
  assert.equal(twice.length, 2);
});

test("evaluateAlerts ignores a brief CPU spike", () => {
  const now = 2_000_000;
  const samples = [0, 5, 10, 15, 18].map((sec) => {
    const s = sampleAt(now - (20 - sec) * 1000, { running: true, players: 2, worldMb: 200, restOn: true });
    return { ...s, procCpu: sec === 18 ? 95 : 20, hostRamPct: 40 };
  });
  const alerts = evaluateAlerts(samples, DEFAULT_THRESHOLDS, now);
  assert.equal(alerts.some((a) => a.kind === "cpu"), false);
});

test("evaluateAlerts fires on sustained PalServer CPU", () => {
  const now = 3_000_000;
  const samples = [0, 5, 10, 15, 20].map((sec) => ({
    ...sampleAt(now - (20 - sec) * 1000, { running: true, players: 8, worldMb: 800, restOn: true }),
    procCpu: 92,
    hostRamPct: 40,
  }));
  const alerts = evaluateAlerts(samples, DEFAULT_THRESHOLDS, now);
  const cpu = alerts.find((a) => a.kind === "cpu");
  assert.ok(cpu);
  assert.equal(cpu.severity, "error");
});

test("evaluateAlerts fires on low REST sim FPS", () => {
  const now = 4_000_000;
  const samples = [0, 6, 12, 18].map((sec) => ({
    ...sampleAt(now - (20 - sec) * 1000, { running: true, players: 20, worldMb: 800, restOn: true }),
    fps: 11,
    procCpu: 40,
    hostRamPct: 50,
  }));
  const alerts = evaluateAlerts(samples, DEFAULT_THRESHOLDS, now);
  assert.ok(alerts.some((a) => a.kind === "fps" && a.severity === "error"));
});

test("buildPulse uses save clock and degrades only on error alerts", () => {
  const pulse = buildPulse({
    running: true,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    players: 4,
    world: {
      id: "w",
      name: "Hollow Isle",
      guid: "g",
      active: true,
      days: 3,
      lastPlayed: new Date().toISOString(),
      sizeMb: 100,
      guilds: 1,
    },
    save: {
      worldId: "w",
      optionOverride: false,
      worldTime: "Day 118 · 14:20",
      players: [],
      guilds: [],
    },
    backups: [],
    session: { peakPlayers: 6, joins: 8, leaves: 2, unique: 6, lastTransition: "Mira joined" },
    alerts: [],
    restOn: true,
  });
  assert.equal(pulse.day, 118);
  assert.equal(pulse.clock, "14:20");
  assert.equal(pulse.health, "running");
  assert.equal(pulse.worldName, "Hollow Isle");

  const degraded = buildPulse({
    running: true,
    startedAt: new Date().toISOString(),
    players: 1,
    backups: [],
    session: { peakPlayers: 1, joins: 1, leaves: 0, unique: 1, lastTransition: null },
    alerts: [
      {
        id: "cpu",
        kind: "cpu",
        severity: "error",
        title: "hot",
        detail: "hot",
        at: new Date().toISOString(),
        active: true,
      },
    ],
    restOn: false,
  });
  assert.equal(degraded.health, "degraded");
  assert.equal(degraded.day, 0);
});

test("stopped pulse is not degraded even with leftover alerts", () => {
  const pulse = buildPulse({
    running: false,
    startedAt: null,
    players: 0,
    backups: [],
    session: { peakPlayers: 0, joins: 0, leaves: 0, unique: 0, lastTransition: null },
    alerts: [
      {
        id: "cpu",
        kind: "cpu",
        severity: "error",
        title: "hot",
        detail: "hot",
        at: new Date().toISOString(),
        active: true,
      },
    ],
    restOn: false,
  });
  assert.equal(pulse.health, "stopped");
});

test("seedHistory marks the restart near startedAt", () => {
  const now = Date.parse("2026-09-19T12:00:00.000Z");
  const startedAt = "2026-09-19T10:00:00.000Z";
  const samples = seedHistory({
    running: true,
    startedAt,
    players: 4,
    worldMb: 1840,
    restOn: true,
    now,
  });
  assert.ok(samples.length > 10);
  assert.ok(samples.some((s) => s.restart));
  assert.equal(samples[0]?.running, false);
  assert.equal(samples[samples.length - 1]?.running, true);
});

test("filterRange and downsample keep restart markers", () => {
  const now = Date.now();
  const samples = seedHistory({
    running: true,
    startedAt: new Date(now - 2 * 3600_000).toISOString(),
    players: 3,
    worldMb: 400,
    restOn: false,
    now,
  });
  const hour = filterRange(samples, "1h", now);
  assert.ok(hour.every((s) => s.t >= now - 3600_000));
  const small = downsample(samples, 20);
  assert.ok(small.length <= 20 + samples.filter((s) => s.restart).length);
});

test("diskForecast is quiet when usage is flat", () => {
  const now = Date.now();
  const samples = seedHistory({
    running: true,
    startedAt: new Date(now - 3 * 3600_000).toISOString(),
    players: 2,
    worldMb: 800,
    restOn: true,
    now,
  });
  assert.equal(projectDisk(samples), null);
  const f = diskForecast(samples);
  assert.match(f.note, /not growing/i);
  assert.ok(f.freeGb > 0);
});

test("diskForecast projects exhaustion when usage climbs", () => {
  const now = 5_000_000;
  const samples = Array.from({ length: 12 }, (_, i) => {
    const s = sampleAt(now - (11 - i) * 600_000, { running: true, players: 4, worldMb: 100, restOn: false });
    return { ...s, diskUsedPct: 40 + i * 4, diskFreeGb: 200 - i * 10 };
  });
  const note = projectDisk(samples);
  assert.ok(note && /fills in/i.test(note));
});

test("settingOn reads REST and RCON flags", () => {
  const settings = [
    { key: "RESTAPIEnabled", value: "True" },
    { key: "RCONEnabled", value: "False" },
  ];
  assert.equal(settingOn(settings, "RESTAPIEnabled"), true);
  assert.equal(settingOn(settings, "RCONEnabled"), false);
  assert.equal(settingOn(undefined, "RESTAPIEnabled"), false);
});
