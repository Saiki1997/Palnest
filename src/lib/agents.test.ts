import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentProbe, preferredAgent } from "./agents.ts";

test("parseAgentProbe marks installed and running PortWarp", () => {
  const scan = parseAgentProbe({
    portwarp: { path: "C:\\PortWarp\\pwrp.exe", running: true },
    playit: {},
    simulated: false,
  });
  assert.equal(scan.portwarp.installed, true);
  assert.equal(scan.portwarp.running, true);
  assert.equal(preferredAgent(scan), "portwarp");
  assert.equal(scan.playit.installed, false);
});
