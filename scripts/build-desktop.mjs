#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist-desktop");
const artifacts = path.join(root, "artifacts");
const publishDir = path.join(root, "publish", "win-x64");
const dotnet = path.join(root, ".dotnet", "dotnet");

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

const dotnetEnv = {
  DOTNET_ROOT: path.join(root, ".dotnet"),
  DOTNET_CLI_HOME: path.join(root, ".dotnet-home"),
  DOTNET_NOLOGO: "1",
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
};
dotnetEnv.PATH = `${dotnetEnv.DOTNET_ROOT}:${process.env.PATH ?? ""}`;

console.log("[palnest-desktop] publishing C# host win-x64…");
await run(
  fs.existsSync(dotnet) ? dotnet : "dotnet",
  [
    "publish",
    "Palnest.App/Palnest.App.csproj",
    "-c",
    "Release",
    "-r",
    "win-x64",
    "--self-contained",
    "true",
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-p:EnableCompressionInSingleFile=true",
    "-p:DebugType=none",
    "-o",
    publishDir,
  ],
  dotnetEnv,
);

const exe = path.join(publishDir, "Palnest.exe");
if (!fs.existsSync(exe)) {
  throw new Error("dotnet publish did not emit Palnest.exe");
}

console.log("[palnest-desktop] packaging Windows installer + zip…");
await run("npx", ["electron-builder", "--win", "nsis", "zip", "--x64", "--config", "electron-builder.yml"], {
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
});

const zips = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith(".zip") && /win/i.test(f))
  .map((f) => path.join(distDir, f));
zips.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
if (!zips.length) throw new Error("electron-builder did not emit a Windows zip");
const zip = zips[0];
copyIfExists(zip, path.join(artifacts, "Palnest-windows.zip"));
copyIfExists(zip, path.join(distDir, "Palnest-windows.zip"));

const setups = fs
  .readdirSync(distDir)
  .filter((f) => /\.exe$/i.test(f) && /setup/i.test(f))
  .map((f) => path.join(distDir, f));
setups.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
if (!setups[0]) throw new Error("electron-builder did not emit a Windows installer");
copyIfExists(setups[0], path.join(artifacts, "Palnest-Setup.exe"));
copyIfExists(setups[0], path.join(distDir, "Palnest-Setup.exe"));

console.log("[palnest-desktop] installer", setups[0]);
console.log("[palnest-desktop] zip", zip);
