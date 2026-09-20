import assert from "node:assert/strict";
import test from "node:test";
import { markupToHtml, stripBbcode } from "./mod-markup.ts";

const BEEGARDE = `[size=4][b]Description[/b][/size]

[color=#D4D4D8]This mod simply adds kindling, watering, electricity, and cooling to beegarde to make them truly a drone
(Mining is far too glitchy so they still can't mine)[/color]

[size=4][b]Installation instructions[/b][/size]

[size=3][color=#D4D4D8]Extract and put in Palschema[/color][/size]

[size=4][b]Requirements[/b][/size]

[size=3][color=#D4D4D8]Palschema[/color][/size]

Made with Schema Studio

https://www.nexusmods.com/palworld/mods/5095?tab=description`;

test("Nexus BBCode headings and colors render, tags do not leak", () => {
  const html = markupToHtml(BEEGARDE);
  assert.equal(html.includes("[size="), false);
  assert.equal(html.includes("[b]"), false);
  assert.equal(html.includes("[color="), false);
  assert.match(html, /<h4>.*Description.*<\/h4>/);
  assert.match(html, /<h4>.*Installation instructions.*<\/h4>/);
  assert.match(html, /<h4>.*Requirements.*<\/h4>/);
  assert.match(html, /kindling, watering, electricity/);
  assert.match(html, /Extract and put in Palschema/);
  assert.match(html, /style="color:#D4D4D8"/);
  assert.match(html, /href="https:\/\/www\.nexusmods\.com\/palworld\/mods\/5095/);
});

test("lists, urls, and leftover tags", () => {
  const html = markupToHtml(`[list]\n[*]One\n[*]Two\n[/list]\n[url=https://example.com]Docs[/url]\n[font=Verdana]plain[/font]`);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>One<\/li>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.equal(html.includes("[font"), false);
});

test("javascript urls are dropped", () => {
  const html = markupToHtml(`[url=javascript:alert(1)]x[/url]`);
  assert.equal(html.includes("javascript:"), false);
});

test("stripBbcode leaves readable card copy", () => {
  assert.equal(stripBbcode("[b]Hello[/b] world"), "Hello world");
});
