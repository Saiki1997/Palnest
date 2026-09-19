# Palnest — Palworld Server & Mod Manager 1.0.6

Desktop + web manager for Palworld dedicated servers: worlds, mods, SteamCMD, PortWarp / playit.gg tunnels, backups, REST admin, and Engine.ini performance tweaks.

## Features

- Multi-world fleet with in-app PalServer console (no extra terminals)
- Import an existing PalServer folder
- SteamCMD install / check for updates
- Mod search by name, id, or Nexus/Thunderstore URL
- Boot-time mod conflict checker
- Scheduled restart + backups (10 min / 1 h / 6 h / 12 h / 1 day)
- Players (kick / ban) and guilds
- Optimize presets: heavy, heavy-mod, network, server performance
- Windows app (`Palnest.exe`) via Electron

## Run

```bash
npm install
npm run dev
```

Windows desktop package:

```bash
npm run desktop:pack
```

Unzip the artifact and run `Palnest.exe`. PalServer is spawned from the PalServer folder so PortWarp / playit.gg can bind it.

## Stack

TanStack Start, React 19, Tailwind v4, Electron 35, Zustand.
