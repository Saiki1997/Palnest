import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceTunnel, idleTunnel, parseAgentLine, tunnelLaunchFlags } from "./tunnels.ts";

const ctx = { name: "Sunreach", slot: 0, port: 8211, queryPort: 27015, provider: "playit" as const };

test("parseAgentLine reads the playit claim link", () => {
  const hit = parseAgentLine("playit", "Visit https://playit.gg/claim/ab12CD34 to claim this agent");
  assert.equal(hit.claimUrl, "https://playit.gg/claim/ab12CD34");
  assert.equal(hit.claimCode, "ab12CD34");
});

test("parseAgentLine reads a playit public address but not the local port", () => {
  assert.deepEqual(parseAgentLine("playit", "tunnel running 127.0.0.1:8211"), {});
  assert.deepEqual(parseAgentLine("playit", "forwarding to local 192.168.1.4:8211"), {});
  const hit = parseAgentLine("playit", "Palworld tunnel: sunreach.gl.at.ply.gg:30051 => 127.0.0.1:8211");
  assert.deepEqual(hit.game, { host: "sunreach.gl.at.ply.gg", port: 30051, ip: "" });
});

test("parseAgentLine ignores addresses on other domains", () => {
  assert.deepEqual(parseAgentLine("playit", "fetched api.example.com:443"), {});
  assert.deepEqual(parseAgentLine("portwarp", "sunreach.gl.at.ply.gg:30051"), {});
});

test("desktop tunnels never invent claim codes or addresses", () => {
  const installed = advanceTunnel(idleTunnel(8211, "playit"), "install", { ...ctx, real: true });
  assert.equal(installed.claimCode, "");
  assert.equal(installed.claimUrl, "");
  const created = advanceTunnel(installed, "create", { ...ctx, real: true });
  assert.equal(created.game, null);
  const online = advanceTunnel(created, "start", { ...ctx, real: true });
  assert.equal(online.status, "online");
  assert.equal(online.game, null);
  assert.deepEqual(tunnelLaunchFlags(online), { publicIp: "", publicPort: null });
});

test("the browser preview still walks the demo flow", () => {
  const installed = advanceTunnel(idleTunnel(8211, "playit"), "install", ctx);
  assert.match(installed.claimUrl, /^https:\/\/playit\.gg\/claim\//);
  const online = advanceTunnel(advanceTunnel(installed, "confirm", ctx), "start", ctx);
  assert.equal(online.status, "online");
  assert.ok(online.game);
});
