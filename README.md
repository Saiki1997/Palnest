# Palnest — Palworld Server & Mod Manager

Windows desktop app for dedicated Palworld servers, mods, and worlds. **3.0.0**.

## Download (Windows)

- **Installer wizard** — `Palnest-Setup-3.0.0.exe` on the [latest release](https://github.com/Saiki1997/Palnest/releases/latest)
- **Zip** — `Palnest-3.0.0-windows.zip` (unzip and run Palnest.exe)

## What it does

- **Server only / Client only / Client + server**
- Dashboard node cards: start, stop, restart, clone, delete
- PalServer update check from SteamCMD on the dashboard
- Players: kick, ban, copy ID, join MOTD (`{player}` / `{world}`), RCON
- Guilds: add, remove members, delete
- PalWorldSettings.ini and WorldOption.sav editors with Save
- Engine.ini tweaks (client / server) with Save
- Mods: installed / discover / history, Steam, CurseForge, Nexus
- Frameworks: UE4SS, PalSchema, OptiScaler, ReShade (mode-aware)
- Tunnels: auto-detect playit.gg and PortWarp, download if missing
- Worlds and backups, scheduled restart and crash watchdog
- Export / import Palnest.json

Broken packs warn. They do not block start.

## Tests

```
npm run typecheck
node --test src/lib/ops.test.ts src/lib/fleet.test.ts
```
