#!/usr/bin/env node
/**
 * Build Palnest for Windows:
 *   1. Assemble the local den (Nitro static + fetch handler)
 *   2. electron-builder → unpacked win32 app (zip/dir)
 *   3. Custom NSIS MUI2 wizard (.exe) — folder + shortcut options
 *   4. Flatten the portable zip (extract and run, no registry)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";

const root = process.cwd();
const distDir = path.join(root, "dist-desktop");
const artifacts = path.join(root, "artifacts");
const hostDir = path.join(root, "desktop-host");
const vercelOut = path.join(root, ".vercel", "output");
const version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version || "3.0.0";

function run(cmd, args, env = {}, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

async function download(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function which(bin) {
  const paths = (process.env.PATH || "").split(path.delimiter);
  for (const dir of paths) {
    const full = path.join(dir, bin);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

function writePackagedReadme() {
  const body = `Palnest ${version} — Palworld Server & Mod Manager
=============================================

Two Windows packages ship with this release:

1) Installer — Palnest-Setup-${version}.exe
   Run the setup wizard. Pages:
     Welcome → License → Shortcuts → Install folder → Copy files → Finish
   You choose:
     • Installation directory (Browse)
     • Desktop shortcut (optional)
     • Start menu shortcut (optional)
   Uninstall from Settings → Apps, or Start menu → Palnest → Uninstall Palnest.

2) Portable — Palnest-${version}-windows.zip
   No installer. Extract the Palnest folder anywhere and double-click Palnest.exe.
   Keep the whole folder together — Palnest.exe needs the files beside it.
   This build does not write uninstall registry keys or require Administrator.

First launch
  Choose Server only, Client only, or Client + server, then Browse to
  Palworld and/or PalServer. Palnest can start PalServer, install mods
  (Steam / CurseForge / Nexus Mods), clone or delete worlds, edit
  PalWorldSettings.ini, run RCON, and watch the box from this window.

Close goes to the tray. palnest:// links open mods and join hosts.

https://github.com/Saiki1997/Palnest
`;
  fs.writeFileSync(path.join(root, "electron", "resources", "README.txt"), body);
}

function assembleHost() {
  if (!fs.existsSync(path.join(vercelOut, "functions", "__server.func", "index.mjs"))) {
    throw new Error("Run npm run build first so .vercel/output exists.");
  }
  fs.rmSync(hostDir, { recursive: true, force: true });
  fs.mkdirSync(hostDir, { recursive: true });
  copyDir(path.join(vercelOut, "static"), path.join(hostDir, "static"));
  copyDir(path.join(vercelOut, "functions"), path.join(hostDir, "functions"));
  fs.copyFileSync(path.join(root, "electron", "serve.mjs"), path.join(hostDir, "serve.mjs"));
  copyIfExists(path.join(root, "electron", "resources", "README.txt"), path.join(hostDir, "README.txt"));
  copyIfExists(path.join(root, "electron", "resources", "LICENSE.txt"), path.join(hostDir, "LICENSE.txt"));
}

function injectHostIntoUnpacked(unpacked) {
  const dest = path.join(unpacked, "resources", "host");
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(hostDir, dest);
  console.log("[palnest-desktop] injected latest den into", dest);
}

function addPortableExtras(folder) {
  copyIfExists(path.join(root, "electron", "resources", "README.txt"), path.join(folder, "README.txt"));
  copyIfExists(path.join(root, "electron", "resources", "LICENSE.txt"), path.join(folder, "LICENSE.txt"));
  copyIfExists(path.join(root, "electron", "resources", "PORTABLE.txt"), path.join(folder, "PORTABLE.txt"));
  copyIfExists(path.join(root, "electron", "resources", "Launch Palnest.cmd"), path.join(folder, "Launch Palnest.cmd"));
}

async function flattenPortableZip(zipPath, destZip) {
  const { execFileSync } = await import("node:child_process");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "palnest-zip-"));
  const unpacked = path.join(tmp, "unpacked");
  fs.mkdirSync(unpacked);
  execFileSync("unzip", ["-q", zipPath, "-d", unpacked]);
  const kids = fs.readdirSync(unpacked);
  const inner =
    kids.length === 1 && fs.statSync(path.join(unpacked, kids[0])).isDirectory()
      ? path.join(unpacked, kids[0])
      : unpacked;
  addPortableExtras(inner);
  const stage = path.join(tmp, "Palnest");
  fs.mkdirSync(stage);
  fs.cpSync(inner, stage, { recursive: true });
  const outAbs = path.resolve(destZip);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  if (fs.existsSync(outAbs)) fs.unlinkSync(outAbs);
  const zipBin = which("zip");
  if (zipBin) {
    execFileSync(zipBin, ["-r", "-q", "-9", outAbs, "Palnest"], { cwd: tmp });
  } else {
    await zipWithPython(stage, outAbs, "Palnest");
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

async function zipWithPython(folder, destZip, prefix) {
  const { execFileSync } = await import("node:child_process");
  const script = `
import os, zipfile, sys
root, dest, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(root):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.join(prefix, os.path.relpath(full, root))
            z.write(full, rel.replace("\\\\", "/"))
`;
  const py = path.join(os.tmpdir(), "palnest-zip.py");
  fs.writeFileSync(py, script);
  execFileSync("python3", [py, folder, destZip, prefix]);
}

async function ensureNsisLinux() {
  const cached = path.join(root, ".cache", "nsis-308");
  const makensis = path.join(cached, "usr", "bin", "makensis");
  const nsisdir = path.join(cached, "usr", "share", "nsis");
  if (fs.existsSync(makensis) && fs.existsSync(path.join(nsisdir, "Stubs"))) {
    return { makensis, nsisdir };
  }
  fs.mkdirSync(cached, { recursive: true });
  const commonDeb = path.join(cached, "nsis-common.deb");
  const nsisDeb = path.join(cached, "nsis.deb");
  console.log("[palnest-desktop] downloading Linux NSIS 3.08 (makensis)…");
  await download(
    "https://ftp.debian.org/debian/pool/main/n/nsis/nsis-common_3.08-3+deb12u1_all.deb",
    commonDeb,
  );
  await download("https://ftp.debian.org/debian/pool/main/n/nsis/nsis_3.08-3+deb12u1_amd64.deb", nsisDeb);
  const { execFileSync } = await import("node:child_process");
  const extract = (deb) => {
    if (which("dpkg-deb")) {
      execFileSync("dpkg-deb", ["-x", deb, cached]);
      return;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "deb-"));
    execFileSync("ar", ["x", deb], { cwd: tmp });
    const data = fs.readdirSync(tmp).find((f) => f.startsWith("data.tar"));
    if (!data) throw new Error("deb missing data.tar");
    execFileSync("tar", ["-xf", path.join(tmp, data), "-C", cached]);
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  extract(commonDeb);
  extract(nsisDeb);
  if (!fs.existsSync(makensis)) throw new Error("makensis missing after NSIS extract");
  return { makensis, nsisdir };
}

async function generateAssets() {
  const { execFileSync } = await import("node:child_process");
  execFileSync("python3", [path.join(root, "scripts", "make-installer-assets.py")], { stdio: "inherit" });
}

async function buildInstallerWizard(unpackedDir) {
  const { makensis, nsisdir } = await ensureNsisLinux();
  await generateAssets();
  const ico = path.join(root, "electron", "resources", "icon.ico");
  const sidebar = path.join(root, "electron", "resources", "wizard", "sidebar.bmp");
  const header = path.join(root, "electron", "resources", "wizard", "header.bmp");
  const license = path.join(root, "electron", "resources", "LICENSE.txt");
  const readme = path.join(root, "electron", "resources", "README.txt");
  const nsi = path.join(root, "electron", "installer.nsi");
  const outExe = path.join(distDir, `Palnest-Setup-${version}.exe`);
  if (fs.existsSync(outExe)) fs.unlinkSync(outExe);
  console.log("[palnest-desktop] compiling NSIS setup wizard with makensis…");
  await run(
    makensis,
    [
      "-V2",
      `-DVERSION=${version}`,
      `-DAPP_DIR=${unpackedDir.replace(/\\/g, "/")}`,
      `-DOUT_FILE=${outExe.replace(/\\/g, "/")}`,
      `-DICON=${ico.replace(/\\/g, "/")}`,
      `-DLICENSE=${license.replace(/\\/g, "/")}`,
      `-DREADME=${readme.replace(/\\/g, "/")}`,
      `-DSIDEBAR_BMP=${sidebar.replace(/\\/g, "/")}`,
      `-DHEADER_BMP=${header.replace(/\\/g, "/")}`,
      nsi,
    ],
    { NSISDIR: nsisdir },
  );
  if (!fs.existsSync(outExe)) throw new Error("makensis did not emit the installer");
  return outExe;
}

function findUnpacked() {
  const candidates = [
    path.join(distDir, "win-unpacked"),
    path.join(distDir, "Palnest-win32-x64"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "Palnest.exe")) || fs.existsSync(path.join(dir, "electron.exe"))) return dir;
  }
  if (!fs.existsSync(distDir)) return null;
  for (const name of fs.readdirSync(distDir)) {
    const dir = path.join(distDir, name);
    if (fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, "Palnest.exe"))) return dir;
  }
  return null;
}

function latestFile(dir, pred) {
  if (!fs.existsSync(dir)) return null;
  const hits = fs
    .readdirSync(dir)
    .filter(pred)
    .map((f) => path.join(dir, f));
  hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return hits[0] || null;
}

function writeManifest(setupName, zipName) {
  const payload = {
    version,
    setup: `/desktop/${setupName}`,
    portable: `/desktop/${zipName}`,
    builtAt: new Date().toISOString(),
    wizard: {
      chooseDirectory: true,
      desktopShortcut: "optional",
      startMenuShortcut: "optional",
      license: true,
      finishLaunch: true,
    },
    portableNotes: "Extract Palnest folder and run Palnest.exe. No registry install.",
  };
  fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(artifacts, "palnest-desktop-manifest.json"), JSON.stringify(payload, null, 2));
}

fs.mkdirSync(artifacts, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

writePackagedReadme();
console.log("[palnest-desktop] assembling local den…");
assembleHost();

const unpackedNow = findUnpacked();
const skipPackager = process.env.PALNEST_SKIP_PACKAGER === "1" && unpackedNow;
if (skipPackager) {
  console.log("[palnest-desktop] reusing unpacked app at", unpackedNow);
} else {
  console.log("[palnest-desktop] packaging Windows unpacked app…");
  try {
    await run("npx", ["electron-builder", "--win", "dir", "--x64", "--config", "electron-builder.yml"], {
      CSC_IDENTITY_AUTO_DISCOVERY: "false",
      ELECTRON_BUILDER_BINARIES_MIRROR: process.env.ELECTRON_BUILDER_BINARIES_MIRROR || "",
    });
  } catch (err) {
    if (!findUnpacked()) throw new Error(`electron-builder failed: ${err instanceof Error ? err.message : err}`);
    console.warn("[palnest-desktop] electron-builder warned, continuing with unpacked dir");
  }
}

const unpacked = findUnpacked();
if (!unpacked) throw new Error("no Windows unpacked directory — cannot build installer or zip");

injectHostIntoUnpacked(unpacked);
copyIfExists(path.join(root, "electron", "resources", "README.txt"), path.join(unpacked, "README.txt"));
copyIfExists(path.join(root, "electron", "resources", "LICENSE.txt"), path.join(unpacked, "LICENSE.txt"));

const palnestExe = ["Palnest.exe", "electron.exe"]
  .map((n) => path.join(unpacked, n))
  .find((p) => fs.existsSync(p));
if (palnestExe) {
  await run("node", [path.join(root, "scripts", "stamp-exe-version.mjs"), palnestExe, version]);
}

const setup = await buildInstallerWizard(unpacked);

let zip = path.join(distDir, `Palnest-${version}-windows.zip`);
const tmpZip = path.join(distDir, `_raw-${version}.zip`);
await zipWithPython(unpacked, tmpZip, "Palnest");
await flattenPortableZip(tmpZip, zip);
fs.rmSync(tmpZip, { force: true });

const setupDest = path.join(distDir, `Palnest-Setup-${version}.exe`);
if (path.resolve(setup) !== path.resolve(setupDest)) copyIfExists(setup, setupDest);
copyIfExists(setupDest, path.join(artifacts, `Palnest-Setup-${version}.exe`));
copyIfExists(setupDest, path.join(artifacts, "Palnest-Setup.exe"));
copyIfExists(zip, path.join(artifacts, `Palnest-${version}-windows.zip`));
copyIfExists(zip, path.join(artifacts, "Palnest-windows.zip"));

writeManifest(`Palnest-Setup-${version}.exe`, `Palnest-${version}-windows.zip`);

console.log("[palnest-desktop] installer", setupDest);
console.log("[palnest-desktop] zip", zip);
