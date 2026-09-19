# Palnest — Palworld Server & Mod Manager

Windows desktop app for dedicated Palworld servers, mods, and worlds.

![Palnest dashboard](docs/screenshot.jpg)

## Download (Windows)

- **Installer wizard** — `Palnest-Setup-2.1.0.exe` on the [latest release](https://github.com/Saiki1997/Palnest/releases/latest)
- **Zip** — `Palnest-2.1.0-windows.zip` (unzip and run Palnest.exe)

## What it does

- Create or import a PalServer world
- Start / stop PalServer.exe in-app (no extra terminals)
- Mods: name, id, or store URL → PAK / UE4SS / PalSchema folders
- Engine.ini presets for heavy worlds and network
- Players, guilds, kick / ban
- Background sampling sleeps when nothing is live

Broken packs warn. They do not block start. If PalServer crashes, Palnest names the pack.

## Tests

```
dotnet test Palnest.Tests
```
