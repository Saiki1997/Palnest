import assert from "node:assert/strict";
import test from "node:test";
import { discoverPathId, matchesModQuery, parseDiscoverId, parseModQuery } from "./mod-query.ts";

test("parseModQuery reads Steam, Nexus, CurseForge URLs and numeric ids", () => {
  const steam = parseModQuery("https://steamcommunity.com/sharedfiles/filedetails/?id=3456789");
  assert.equal(steam.source, "steam");
  assert.equal(steam.sourceId, "3456789");
  const nexus = parseModQuery("https://www.nexusmods.com/palworld/mods/1018");
  assert.equal(nexus.source, "nexus");
  assert.equal(nexus.sourceId, "1018");
  const id = parseModQuery("524");
  assert.equal(id.sourceId, "524");
  const name = parseModQuery("Pal Schema");
  assert.equal(name.text, "Pal Schema");
  assert.equal(name.sourceId, undefined);
});

test("matchesModQuery finds catalog rows by id, url, or name", () => {
  const mod = {
    id: "nx-palschema",
    name: "Pal Schema",
    author: "Okaetsu",
    source: "nexus",
    sourceId: "1018",
    url: "https://www.nexusmods.com/palworld/mods/1018",
    category: "Frameworks",
    tags: ["framework"],
    description: "JSON-driven",
  };
  assert.equal(matchesModQuery(mod, "1018", "nexus"), true);
  assert.equal(matchesModQuery(mod, "https://www.nexusmods.com/palworld/mods/1018"), true);
  assert.equal(matchesModQuery(mod, "schema"), true);
  assert.equal(matchesModQuery(mod, "99999", "nexus"), false);
});

test("parseDiscoverId reads source--id and live prefixes", () => {
  const tagged = parseDiscoverId("nexus--1018");
  assert.equal(tagged.source, "nexus");
  assert.equal(tagged.sourceId, "1018");
  const live = parseDiscoverId("nx-live-524");
  assert.equal(live.source, "nexus");
  assert.equal(live.sourceId, "524");
  const steam = parseDiscoverId("st-live-3456789");
  assert.equal(steam.source, "steam");
  assert.equal(steam.sourceId, "3456789");
  assert.equal(discoverPathId("curseforge", "99"), "curseforge--99");
});
