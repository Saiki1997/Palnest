# Palnest 2.0 — Palworld Server & Mod Manager

C# (ASP.NET Core + Blazor) rewrite. One process, no Chromium shell. Background sampling sleeps when no world is live.

## Run

```bash
dotnet run --project Palnest.App --urls http://0.0.0.0:8080
```

Windows: `dotnet publish Palnest.App -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true`

## Tests

```bash
dotnet test Palnest.Tests
```

## What to try

- **Create new server** on the dashboard (header and the dashed card)
- Import an existing PalServer folder
- Start / stop — console stays inside Palnest
- Discover mods (name, id, or store URL) — PAK vs UE4SS vs PalSchema folders
- Optimize Engine.ini presets
- Worlds: guilds, kick / ban

Broken mods warn only. If PalServer crashes, Palnest names the pack.
