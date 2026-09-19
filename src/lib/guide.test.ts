import assert from "node:assert/strict";
import test from "node:test";
import { denGuide, guideProgress, guideRemaining, guideShouldShow } from "./guide.ts";

const base = {
  onboarded: true,
  mode: "client" as const,
  paths: { client: "", server: "" },
  keys: { nexus: "", steam: "", curseforge: "" },
  frameworks: {
    ue4ss: { clientVersion: null, serverVersion: null },
    palschema: { clientVersion: null, serverVersion: null },
  },
  mods: [] as { target: string }[],
  checkerRan: false,
};

test("client guide hides the dedicated path step", () => {
  const steps = denGuide(base);
  assert.equal(steps.some((s) => s.id === "path-server"), false);
  assert.equal(steps.some((s) => s.id === "path-client"), true);
  assert.equal(guideRemaining(steps).map((s) => s.id).includes("ue4ss"), true);
});

test("optional path does not block remaining required steps", () => {
  const steps = denGuide({ ...base, paths: { client: "C:\\Palworld", server: "" } });
  const path = steps.find((s) => s.id === "path-client");
  assert.equal(path?.done, true);
  assert.equal(path?.optional, true);
  assert.ok(guideProgress(steps).pct < 100);
});

test("both mode requires UE4SS on each side", () => {
  const steps = denGuide({
    ...base,
    mode: "both",
    frameworks: {
      ue4ss: { clientVersion: "2281fa31", serverVersion: null },
      palschema: { clientVersion: "0.6.71", serverVersion: "0.6.71" },
    },
  });
  assert.equal(steps.find((s) => s.id === "ue4ss")?.done, false);
  assert.equal(steps.find((s) => s.id === "palschema")?.done, true);
  assert.equal(steps.some((s) => s.id === "path-server"), true);
});

test("guide hides when dismissed even if work remains", () => {
  const steps = denGuide(base);
  assert.equal(guideShouldShow(steps, true), false);
  assert.equal(guideShouldShow(steps, false), true);
});

test("server guide includes an optional tunnel step", () => {
  const steps = denGuide({ ...base, mode: "server" });
  const tunnel = steps.find((s) => s.id === "tunnel");
  assert.equal(tunnel?.optional, true);
  assert.equal(tunnel?.done, false);
  const done = denGuide({
    ...base,
    mode: "server",
    instances: [{ running: true, tunnel: { status: "online" } }],
  });
  assert.equal(done.find((s) => s.id === "tunnel")?.done, true);
});

test("client guide hides tunnel", () => {
  const steps = denGuide(base);
  assert.equal(steps.some((s) => s.id === "tunnel"), false);
});
