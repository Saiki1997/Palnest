#!/usr/bin/env node
/** Stamp Palnest.exe VERSIONINFO so Windows Properties shows 3.0.0, not Electron/2.2.0. */
import fs from "node:fs";
import { NtExecutable, NtExecutableResource, Resource } from "resedit";

const exePath = process.argv[2];
const version = process.argv[3] || "3.0.0";
if (!exePath || !fs.existsSync(exePath)) {
  console.error("usage: stamp-exe-version.mjs <Palnest.exe> [3.0.0]");
  process.exit(1);
}

const parts = version.split(".").map((n) => Number(n) || 0);
while (parts.length < 4) parts.push(0);
const [maj, min, pat, bld] = parts;
const lang = 1033;

const data = fs.readFileSync(exePath);
const exe = NtExecutable.from(data, { ignoreCert: true });
const res = NtExecutableResource.from(exe);
let vis = Resource.VersionInfo.fromEntries(res.entries);
if (!vis.length) {
  vis = [Resource.VersionInfo.createEmpty()];
}
for (const vi of vis) {
  vi.setFileVersion(maj, min, pat, bld, lang);
  vi.setProductVersion(maj, min, pat, bld, lang);
  vi.setStringValues(
    { lang, codepage: 1200 },
    {
      CompanyName: "Palnest",
      FileDescription: "Palworld Server & Mod Manager",
      FileVersion: version,
      InternalName: "Palnest",
      LegalCopyright: "Copyright (c) 2026 Palnest",
      OriginalFilename: "Palnest.exe",
      ProductName: "Palnest",
      ProductVersion: version,
      Comments: "https://github.com/Saiki1997/Palnest",
    },
  );
  vi.outputToResourceEntries(res.entries);
}
res.outputResource(exe);
const out = Buffer.from(exe.generate());
const tmp = `${exePath}.stamped`;
fs.writeFileSync(tmp, out);
fs.renameSync(tmp, exePath);
console.log("[palnest-desktop] stamped", exePath, version);
