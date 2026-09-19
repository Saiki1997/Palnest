#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dotnet = path.join(root, ".dotnet", "dotnet");
const env = {
  ...process.env,
  DOTNET_ROOT: path.join(root, ".dotnet"),
  DOTNET_CLI_HOME: path.join(root, ".dotnet-home"),
  DOTNET_NOLOGO: "1",
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  ASPNETCORE_URLS: "http://0.0.0.0:8080",
  ASPNETCORE_ENVIRONMENT: "Production",
};
env.PATH = `${env.DOTNET_ROOT}:${env.PATH ?? ""}`;

const arg = process.argv[2];
const args =
  arg === "--test"
    ? ["test", "Palnest.Tests/Palnest.Tests.csproj", "--nologo"]
    : arg === "--build"
      ? ["build", "Palnest.sln", "-c", "Release", "--nologo"]
      : ["run", "--project", "Palnest.App", "--no-launch-profile", "--urls", "http://0.0.0.0:8080"];

const child = spawn(dotnet, args, { cwd: root, env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
