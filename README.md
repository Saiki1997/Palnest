# Palnest — Palworld Server & Mod Manager

**3.1.0** · Windows desktop app for dedicated Palworld servers, mods, worlds, and client frameworks.

[Download latest release](https://github.com/Saiki1997/Palnest/releases/latest)

![Dashboard](docs/dashboard.png)

Palnest runs PalServer from the dashboard, edits `PalWorldSettings.ini` / `WorldOption.sav` / `Engine.ini`, installs mods from Nexus, Steam Workshop, and CurseForge, and manages UE4SS, PalSchema, OptiScaler, and ReShade. Changes stay draft until you press **Save**.

---

## Requirements

| Need | Details |
|---|---|
| OS | Windows 10 or 11, 64-bit |
| Server mode | Palworld Dedicated Server from Steam (`PalServer.exe`, app **2394010**) |
| Client mode | Palworld game install (`Palworld.exe`) |
| Client + server | Both installs. Mods can be mirrored or kept apart |
| Optional | [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD) for dedicated updates |
| Optional | Nexus Mods API key, CurseForge API key, GitHub PAT |
| Optional | playit.gg or PortWarp for public tunnels |
| Optional | RCON password (set in world settings) for live commands |

You do **not** need Palworld running to open Palnest. Paths can be filled in later.

---

## Install

**Setup wizard** — `Palnest-Setup-3.1.0.exe` from [Releases](https://github.com/Saiki1997/Palnest/releases/latest)

1. Welcome → license
2. Optional desktop and Start menu shortcuts
3. Choose the install folder
4. Finish and launch Palnest

Uninstall from Settings → Apps, or Start menu → Palnest → Uninstall Palnest.

**Portable zip** — `Palnest-3.1.0-windows.zip`

Extract the `Palnest` folder and run `Palnest.exe` (or `Launch Palnest.cmd`). Keep the folder together. No registry, no admin.

---

## First run

1. Pick **Server only**, **Client only**, or **Client + server**.
2. Browse to the Palworld game folder and/or PalServer folder. Empty is fine — you can set them later in Settings.
3. **Enter the world**, or **Load sample world** to try Palnest with demo dens, players, and guilds.

Mode can be changed later in **Settings**. Client-only hides server tools (Server, Worlds, Tunnels). Server-only hides ReShade and OptiScaler.

---

## How to use

### Dashboard

![Dashboard node cards](docs/dashboard.png)

Each den is a node card: start, stop, restart, clone, delete, CPU / RAM, player count, and join info.

- **Start all / Stop all** for the fleet
- **Check for updates** compares your PalServer build to the latest Steam dedicated build. **Update** runs SteamCMD
- Clone copies the den (new id). Delete asks you to type the name first

---

### Server → Ops

![Server ops](docs/server-ops.png)

Scheduled restart (hourly / daily clock), crash watchdog (auto-restart with a cap), start / stop / restart this den.

---

### Server → World settings (`PalWorldSettings.ini`)

![World settings](docs/server-settings.png)

Category sidebar, sliders, and filters. Edit rates, difficulty, PvP, guilds, and RCON. Press **Save** to write `PalWorldSettings.ini` (and `WorldOption.sav` when that tab is used).

Same editor lives under **Worlds → INI**.

![INI editor](docs/worlds-ini.png)

---

### Server → Players

![Players](docs/server-players.png)

- **Join MOTD** — `{player}` and `{world}` are replaced when someone joins. Save to keep it
- **RCON** — type a command (`Info`, `Broadcast`, `KickPlayer`, `BanPlayer`, `Save`) and Send
- Per-player **Kick**, **Ban**, **Copy ID**
- Ban list and allow list, with unban

---

### Server → Guilds

![Guilds](docs/server-guilds.png)

Delete a guild, add a member (player id), remove a member. Save writes the den files.

---

### Server → Instance

![Instance](docs/server-instance.png)

Name, ports, community flag, public IP, RCON port, install path, launch args for this den only.

---

### Logs

![Logs](docs/logs.png)

Tabs for PalServer, Palnest, RCON, REST, and crash. Search, copy, export. Console capture is a Settings switch.

---

### Optimize / Engine.ini

![Engine.ini tweaks](docs/optimize.png)

Live `Engine.ini` editor with client / server blocks. Presets (heavy, heavy mods, network). Launch-arg extras. **Save** writes the ini.

---

### Mods

![Installed mods](docs/mods.png)

Installed list, enable on client and/or server, identify PAK vs UE4SS vs PalSchema, install plan, history. Broken packs warn — they do not block start. If PalServer crashes, Palnest names the pack.

---

### Discover

![Discover catalog](docs/discover.png)

Nexus, Steam Workshop, and CurseForge catalogs with cover art, category sidebar, filters, and page / next.

Open a card → **Description** and **Files**. Pick the file, then install to client, server, or both.

Paste a name, id, or store URL in Mods if you already know the pack.

API keys in **Settings** unlock full Nexus / CurseForge / GitHub rate limits.

---

### Frameworks

Missing-side banners (**server missing** / **client missing**) only show in **client + server** mode.

**UE4SS** — Palworld build from GitHub, install client and/or server, built-in scripts.

![UE4SS](docs/frameworks-ue4ss.png)

**Pal Schema** — JSON mods that need UE4SS. Dedicated list of PalSchema packs.

![PalSchema](docs/frameworks-palschema.png)

**ReShade** (client) — install, presets, toggle.

![ReShade](docs/frameworks-reshade.png)

**OptiScaler** (client) — FG input/output, FSR upgrade, dxgi overlay.

![OptiScaler](docs/frameworks-optiscaler.png)

---

### Worlds and backups

![Worlds](docs/worlds.png)

List dens, clone, delete (type the name), open folder.

![Backups](docs/worlds-backups.png)

Intervals: 10 min / 1 h / 6 h / 12 h / 1 day. Restore a zip. Export world pack.

![WorldOption.sav](docs/worlds-sav.png)

Inspect `WorldOption.sav` / `Level.sav`, export JSON, write a patched sav.

---

### Tunnels

![Tunnels](docs/tunnels.png)

Palnest looks for **playit.gg** and **PortWarp** on disk. If the agent is missing, **Download** is shown. Start / stop from here. Join host is copied to the dashboard.

---

### Settings

![Settings](docs/settings.png)

Mode, install paths, locale, capture console, Discord webhook, API keys (Nexus, CurseForge, GitHub PAT). **Export Palnest.json** / **Import Palnest.json** moves dens, mods, and keys between PCs.

---

### Health checker

![Checker](docs/checker.png)

UE4SS vs PalSchema vs PAK mismatches, missing frameworks, version notes. Warnings do not block start.

---

## Typical flow

1. Install Palnest and PalServer (and Palworld if you play on the same box)
2. Pick **Client + server**, set both folders
3. Create a den on the dashboard (or import an existing PalServer world)
4. Set ports, community, RCON password → **Save**
5. Install UE4SS, then PalSchema if you need JSON mods
6. Discover a pack → Files → install
7. Start the den. Copy the join IP / tunnel host
8. MOTD + RCON on Players. Backups on Worlds

---

## Keyboard / save rule

Every editor that can change files (INI, Engine.ini, MOTD, frameworks, ops, guilds) shows a **Save** bar. Discard drops the draft. Nothing is written until Save.

---

## Tests (from source)

```
npm run typecheck
node --test src/lib/ops.test.ts src/lib/fleet.test.ts
```

---

## License

Palnest is an independent tool. Palworld is Pocketpair. Nexus Mods, Steam Workshop, and CurseForge remain their own platforms — you need accounts and keys where they require them.
