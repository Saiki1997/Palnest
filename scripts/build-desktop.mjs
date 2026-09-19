#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, ".output-desktop");
const distDir = path.join(root, "dist-desktop");
const artifacts = path.join(root, "artifacts");

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function copyIfExists(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return true;
}

fs.mkdirSync(artifacts, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

process.env.NITRO_PRESET = "node-server";
process.env.NITRO_OUTPUT = ".output-desktop";

console.log("[palnest-desktop] building node-server bundle…");
await run("node", ["scripts/with-app-env.mjs", "vite", "build"], {
  NITRO_PRESET: "node-server",
  NITRO_OUTPUT: ".output-desktop",
});

const entry = path.join(outDir, "server", "index.mjs");
if (!fs.existsSync(entry)) {
  const fallback = path.join(root, ".output", "server", "index.mjs");
  if (!fs.existsSync(fallback)) {
    throw new Error("Desktop build is missing .output-desktop/server/index.mjs");
  }
  fs.cpSync(path.join(root, ".output"), outDir, { recursive: true });
}

console.log("[palnest-desktop] packaging Windows zip…");
await run("npx", ["electron-builder", "--win", "zip", "--x64", "--config", "electron-builder.yml"], {
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
});

const zips = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith(".zip") && /win/i.test(f))
  .map((f) => path.join(distDir, f));
if (!zips.length) {
  throw new Error("electron-builder did not emit a Windows zip");
}
zips.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const zip = zips[0];
copyIfExists(zip, path.join(artifacts, "Palnest-windows.zip"));
copyIfExists(zip, path.join(distDir, "Palnest-windows.zip"));
copyIfExists(zip, path.join(artifacts, "Palnest-Setup.zip"));
copyIfExists(zip, path.join(distDir, "Palnest-Setup.zip"));

const setups = fs
  .readdirSync(distDir)
  .filter((f) => /\.exe$/i.test(f) && /setup/i.test(f))
  .map((f) => path.join(distDir, f));
setups.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
if (setups[0]) {
  copyIfExists(setups[0], path.join(artifacts, "Palnest-Setup.exe"));
  copyIfExists(setups[0], path.join(distDir, "Palnest-Setup.exe"));
}

const unpacked = path.join(distDir, "win-unpacked", "Palnest.exe");
if (fs.existsSync(unpacked)) {
  console.log("[palnest-desktop] Palnest.exe ready at", unpacked);
}

console.log("[palnest-desktop] artifact", zip);
