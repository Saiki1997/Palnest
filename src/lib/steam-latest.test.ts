import assert from "node:assert/strict";
import test from "node:test";
import { parseSteamDedicatedInfo, pinnedLatest } from "./steam-latest.ts";

test("parseSteamDedicatedInfo maps depot 2394011 public gid to a pin", () => {
  const hit = parseSteamDedicatedInfo(
    {
      data: {
        "2394010": {
          depots: {
            "2394011": { manifests: { public: { gid: "1120515" } } },
          },
        },
      },
    },
    "1.0.5",
  );
  assert.equal(hit.version, "1.0.5");
  assert.equal(hit.newer, false);
  assert.equal(hit.source, "steamcmd");
  assert.equal(hit.build, "1120515");
});

test("unknown newer gid is flagged so Palnest can check later dedicated versions", () => {
  const hit = parseSteamDedicatedInfo(
    {
      data: {
        "2394010": {
          depots: {
            "2394011": { manifests: { public: { gid: "9999999" } } },
          },
        },
      },
    },
    "1.0.5",
  );
  assert.equal(hit.newer, true);
  assert.ok(hit.version.includes("9999999"));
});

test("pinnedLatest is the 1.0.5 fallback", () => {
  const pin = pinnedLatest("1.0.5");
  assert.equal(pin.version, "1.0.5");
  assert.equal(pin.newer, false);
  assert.equal(pin.source, "pin");
});
