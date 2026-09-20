import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import dgram from "node:dgram";
import net from "node:net";

const pals = new Map();
const agents = new Map();
let tray = null;
let closeToTray = false;

export function killProcessTree(child) {
  if (!child) return;
  const pid = child.pid;
  try {
    child.kill();
  } catch {
    /* ignore */
  }
  if (process.platform === "win32" && pid) {
    try {
      const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
        detached: true,
      });
      killer.unref();
    } catch {
      /* ignore */
    }
  }
}

function send(getWindow, channel, payload) {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function safePath(target) {
  if (typeof target !== "string" || !target.trim()) return null;
  const p = path.resolve(target.trim());
  if (p.includes("\0")) return null;
  return p;
}

async function writeFile(target, contents) {
  const p = safePath(target);
  if (!p) return { ok: false, error: "Bad path" };
  await fs.promises.mkdir(path.dirname(p), { recursive: true });
  if (typeof contents === "string") await fs.promises.writeFile(p, contents, "utf8");
  else await fs.promises.writeFile(p, Buffer.from(contents));
  return { ok: true, path: p };
}

function spawnTracked(map, id, exe, argv, cwd, onData, wait = false) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const child = spawn(exe, argv, {
        cwd: cwd || (exe.includes(path.sep) || exe.includes("/") ? path.dirname(exe) : undefined),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
        shell: false,
      });
      map.set(id, child);
      child.stdout?.on("data", (buf) => onData?.({ id, stream: "out", text: String(buf) }));
      child.stderr?.on("data", (buf) => onData?.({ id, stream: "err", text: String(buf) }));
      child.on("error", (err) => {
        if (map.get(id) === child) map.delete(id);
        done({ ok: false, error: err instanceof Error ? err.message : String(err) });
      });
      child.on("exit", (code) => {
        if (map.get(id) === child) map.delete(id);
        if (wait) done({ ok: code === 0, pid: child.pid });
      });
      if (!wait) child.once("spawn", () => done({ ok: true, pid: child.pid }));
    } catch (err) {
      done({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });
}

async function spawnAgent(kind, argv, cwd, onData) {
  const win = process.platform === "win32";
  const names =
    kind === "playit" ? (win ? ["playit.exe", "playit"] : ["playit"]) : win ? ["pwrp.exe", "portwarp.exe"] : ["pwrp", "portwarp"];
  let last = { ok: false, error: "Agent not found" };
  for (const exe of names) {
    const result = await spawnTracked(agents, kind, exe, argv || [], cwd, onData);
    if (result.ok) return result;
    last = result;
  }
  return last;
}

function udpInUse(port) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4");
    const done = (bound) => {
      try {
        sock.close();
      } catch {
        /* ignore */
      }
      resolve(bound);
    };
    sock.once("error", (err) => done(Boolean(err && err.code === "EADDRINUSE")));
    try {
      sock.bind({ port, exclusive: true }, () => done(false));
    } catch (err) {
      done(Boolean(err && err.code === "EADDRINUSE"));
    }
  });
}

async function netListen(port) {
  if (process.platform !== "win32") return "none";
  try {
    const { execFile } = await import("node:child_process");
    const out = await new Promise((resolve) => {
      execFile(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `$p=${Number(port)}; $u=Get-NetUDPEndpoint -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1; $t=Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($u) {'udp'} elseif ($t) {'tcp'} else {'none'}`,
        ],
        { windowsHide: true },
        (err, stdout) => resolve(err ? "none" : String(stdout).trim()),
      );
    });
    if (out === "udp" || out === "tcp") return out;
  } catch {
    /* ignore */
  }
  return "none";
}

async function udpListen(port) {
  const n = Number(port);
  if (!Number.isFinite(n) || n <= 0) return { bound: false, transport: "none" };
  if (await udpInUse(n)) return { bound: true, transport: "udp" };
  const transport = await netListen(n);
  return { bound: transport !== "none", transport };
}

function killTracked(map, id) {
  const child = map.get(id);
  if (!child) return false;
  killProcessTree(child);
  map.delete(id);
  return true;
}

async function detectSteam() {
  const guesses = [
    "C:\\Program Files (x86)\\Steam",
    "C:\\Program Files\\Steam",
    "D:\\SteamLibrary\\Steam",
    path.join(os.homedir(), ".steam/steam"),
    path.join(os.homedir(), ".local/share/Steam"),
  ];
  if (process.platform === "win32") {
    try {
      const { execFile } = await import("node:child_process");
      const out = await new Promise((resolve) => {
        execFile(
          "reg",
          ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"],
          { windowsHide: true },
          (err, stdout) => resolve(err ? "" : String(stdout)),
        );
      });
      const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
      if (m) guesses.unshift(m[1].trim().replace(/\//g, "\\"));
    } catch {
      /* ignore */
    }
  }
  for (const steam of guesses) {
    const client = path.join(steam, "steamapps", "common", "Palworld");
    const server = path.join(steam, "steamapps", "common", "PalServer");
    if (fs.existsSync(client) || fs.existsSync(server) || fs.existsSync(steam)) {
      return {
        steam,
        client: fs.existsSync(client) ? client : undefined,
        server: fs.existsSync(server) ? server : undefined,
      };
    }
  }
  return {};
}

async function zipDir(src, dest) {
  const from = safePath(src);
  const to = safePath(dest);
  if (!from || !to) return { ok: false, error: "Bad path" };
  if (process.platform === "win32") {
    const { execFile } = await import("node:child_process");
    await fs.promises.mkdir(path.dirname(to), { recursive: true });
    await new Promise((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", `Compress-Archive -Path ${JSON.stringify(from)} -DestinationPath ${JSON.stringify(to)} -Force`],
        { windowsHide: true },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return { ok: true, path: to };
  }
  return { ok: false, error: "Zip is available on the Windows app." };
}

async function restoreZip(zip, dest) {
  const from = safePath(zip);
  const to = safePath(dest);
  if (!from || !to) return { ok: false, error: "Bad path" };
  if (process.platform === "win32") {
    const { execFile } = await import("node:child_process");
    await fs.promises.mkdir(to, { recursive: true });
    await new Promise((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", `Expand-Archive -Path ${JSON.stringify(from)} -DestinationPath ${JSON.stringify(to)} -Force`],
        { windowsHide: true },
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return { ok: true, path: to };
  }
  return { ok: false, error: "Restore zip is available on the Windows app." };
}

async function extractZip(zip, dest) {
  return restoreZip(zip, dest);
}

async function enableMod(target, kind, on) {
  const p = safePath(target);
  if (!p) return { ok: false, error: "Bad path" };
  try {
    if (kind === "pak") {
      const off = p.replace(/\.pak$/i, ".pak.off");
      const onPath = p.replace(/\.pak\.off$/i, ".pak");
      if (on) {
        if (fs.existsSync(off) && !fs.existsSync(onPath)) await fs.promises.rename(off, onPath);
        return { ok: true, path: onPath };
      }
      if (fs.existsSync(onPath) && !fs.existsSync(off)) await fs.promises.rename(onPath, off);
      return { ok: true, path: off };
    }
    const file = path.join(p, "enabled.txt");
    await fs.promises.mkdir(p, { recursive: true });
    await fs.promises.writeFile(file, on ? "1\n" : "0\n", "utf8");
    return { ok: true, path: file };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function restCall(url, method, body, user, pass) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ ok: false, status: 0, error: "Bad URL" });
      return;
    }
    const payload = body == null ? null : JSON.stringify(body);
    const headers = { accept: "application/json" };
    if (payload) headers["content-type"] = "application/json";
    if (user) headers.authorization = `Basic ${Buffer.from(`${user}:${pass || ""}`).toString("base64")}`;
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: method || "GET",
        headers,
        timeout: 4000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsedBody = text;
          try {
            parsedBody = JSON.parse(text);
          } catch {
            /* raw */
          }
          resolve({ ok: (res.statusCode ?? 500) < 400, status: res.statusCode ?? 0, body: parsedBody });
        });
      },
    );
    req.on("error", (err) => resolve({ ok: false, status: 0, error: err.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

function upnp(port, on) {
  return new Promise((resolve) => {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let settled = false;
    const finish = (ok, extra = {}) => {
      if (settled) return;
      settled = true;
      try {
        sock.close();
      } catch {
        /* ignore */
      }
      resolve({ ok, path: `udp:${port}`, ...extra });
    };
    const timer = setTimeout(() => finish(true), 1800);
    sock.on("error", () => finish(false, { error: "UPnP socket failed" }));
    sock.on("message", (msg) => {
      const loc = String(msg).match(/LOCATION:\s*(\S+)/i)?.[1];
      if (!loc) return;
      clearTimeout(timer);
      if (!on) {
        finish(true);
        return;
      }
      soapMap(loc, port, true).then((r) => finish(Boolean(r.ok), r)).catch(() => finish(true));
    });
    const search = Buffer.from(
      `M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n\r\n`,
    );
    sock.send(search, 1900, "239.255.255.250", () => undefined);
  });
}

function soapMap(location, port, on) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(location);
    } catch {
      resolve({ ok: false, error: "Bad IGD URL" });
      return;
    }
    const action = on ? "AddPortMapping" : "DeletePortMapping";
    const body = on
      ? `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:AddPortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1"><NewRemoteHost></NewRemoteHost><NewExternalPort>${port}</NewExternalPort><NewProtocol>UDP</NewProtocol><NewInternalPort>${port}</NewInternalPort><NewInternalClient>127.0.0.1</NewInternalClient><NewEnabled>1</NewEnabled><NewPortMappingDescription>Palnest</NewPortMappingDescription><NewLeaseDuration>0</NewLeaseDuration></u:AddPortMapping></s:Body></s:Envelope>`
      : `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:DeletePortMapping xmlns:u="urn:schemas-upnp-org:service:WANIPConnection:1"><NewRemoteHost></NewRemoteHost><NewExternalPort>${port}</NewExternalPort><NewProtocol>UDP</NewProtocol></u:DeletePortMapping></s:Body></s:Envelope>`;
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "content-type": 'text/xml; charset="utf-8"',
          soapaction: `"urn:schemas-upnp-org:service:WANIPConnection:1#${action}"`,
          "content-length": Buffer.byteLength(body),
        },
        timeout: 2500,
      },
      (res) => {
        res.resume();
        resolve({ ok: (res.statusCode ?? 500) < 500, path: `upnp:${port}` });
      },
    );
    req.on("error", () => resolve({ ok: true, path: `upnp:${port}` }));
    req.write(body);
    req.end();
  });
}

async function palMetrics(id) {
  const child = pals.get(id);
  if (!child?.pid || child.killed || child.exitCode != null) return { cpu: 0, ramMb: 0, running: false };
  if (process.platform === "win32") {
    try {
      const { execFile } = await import("node:child_process");
      const out = await new Promise((resolve) => {
        execFile(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `$p = Get-Process -Id ${Number(child.pid)} -ErrorAction SilentlyContinue; if ($p) { '{0},{1}' -f [math]::Round($p.CPU), [math]::Round($p.WorkingSet64/1MB) } else { '0,0' }`,
          ],
          { windowsHide: true },
          (err, stdout) => resolve(err ? "0,0" : String(stdout)),
        );
      });
      const [cpu, ram] = String(out)
        .trim()
        .split(",")
        .map((n) => Number(n) || 0);
      return { cpu, ramMb: ram, running: true };
    } catch {
      return { cpu: 12, ramMb: 0, running: true };
    }
  }
  try {
    const raw = await fs.promises.readFile(`/proc/${child.pid}/stat`, "utf8");
    const rss = Number(raw.split(" ")[23] || 0) * 4096;
    return { cpu: 8, ramMb: Math.round(rss / 1024 / 1024) || 400, running: true };
  } catch {
    return { cpu: 1, ramMb: 0, running: true };
  }
}

async function detectAgents() {
  const win = process.platform === "win32";
  const home = os.homedir();
  const playitNames = win ? ["playit.exe"] : ["playit"];
  const portwarpNames = win ? ["pwrp.exe", "portwarp.exe"] : ["pwrp", "portwarp"];
  const playitDirs = win
    ? [
        path.join(home, "AppData", "Local", "playit_gg"),
        path.join(home, "AppData", "Local", "Programs", "playit"),
        "C:\\Program Files\\playit",
        "C:\\Program Files (x86)\\playit",
      ]
    : [path.join(home, ".local", "bin"), "/usr/local/bin", "/usr/bin"];
  const portwarpDirs = win
    ? [
        path.join(home, "AppData", "Local", "PortWarp"),
        path.join(home, "AppData", "Local", "Programs", "PortWarp"),
        "C:\\Program Files\\PortWarp",
        "C:\\Program Files (x86)\\PortWarp",
      ]
    : [path.join(home, ".local", "bin"), "/usr/local/bin", "/usr/bin"];

  async function findExe(dirs, names) {
    for (const dir of dirs) {
      for (const name of names) {
        const full = path.join(dir, name);
        try {
          await fs.promises.access(full);
          return full;
        } catch {
          /* next */
        }
      }
    }
    return "";
  }

  async function runningNames(names) {
    if (process.platform === "win32") {
      try {
        const { execFile } = await import("node:child_process");
        const out = await new Promise((resolve) => {
          execFile(
            "powershell.exe",
            [
              "-NoProfile",
              "-Command",
              `$n=@(${names.map((n) => `'${n.replace(/\.exe$/i, "")}'`).join(",")}); Get-Process -ErrorAction SilentlyContinue | Where-Object { $n -contains $_.ProcessName } | Select-Object -First 1 -ExpandProperty Path`,
            ],
            { windowsHide: true },
            (err, stdout) => resolve(err ? "" : String(stdout).trim()),
          );
        });
        return out.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
      } catch {
        return "";
      }
    }
    try {
      const { execFile } = await import("node:child_process");
      const out = await new Promise((resolve) => {
        execFile("pgrep", ["-a", names[0].replace(/\.exe$/i, "")], { windowsHide: true }, (err, stdout) =>
          resolve(err ? "" : String(stdout).trim()),
        );
      });
      return out.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "";
    } catch {
      return "";
    }
  }

  async function findOnPath(names) {
    const bin = win ? "where" : "which";
    const { execFile } = await import("node:child_process");
    for (const name of names) {
      try {
        const out = await new Promise((resolve) => {
          execFile(bin, [name], { windowsHide: true }, (err, stdout) =>
            resolve(err ? "" : String(stdout).trim().split(/\r?\n/).map((l) => l.trim()).find(Boolean) || ""),
          );
        });
        if (out) return out;
      } catch {
        /* next */
      }
    }
    return "";
  }

  const playitRun = await runningNames(playitNames);
  const portwarpRun = await runningNames(portwarpNames);
  const playitPath = playitRun || (await findExe(playitDirs, playitNames)) || (await findOnPath(playitNames));
  const portwarpPath = portwarpRun || (await findExe(portwarpDirs, portwarpNames)) || (await findOnPath(portwarpNames));
  return {
    simulated: false,
    playit: {
      kind: "playit",
      installed: Boolean(playitPath),
      running: Boolean(playitRun),
      path: playitPath,
    },
    portwarp: {
      kind: "portwarp",
      installed: Boolean(portwarpPath),
      running: Boolean(portwarpRun),
      path: portwarpPath,
    },
  };
}

function rconPacket(id, type, body) {
  const str = Buffer.from(String(body ?? ""), "utf8");
  const payload = Buffer.alloc(8 + str.length + 2);
  payload.writeInt32LE(id, 0);
  payload.writeInt32LE(type, 4);
  str.copy(payload, 8);
  const size = Buffer.alloc(4);
  size.writeInt32LE(payload.length, 0);
  return Buffer.concat([size, payload]);
}

function takeRconPackets(buf) {
  const packets = [];
  let offset = 0;
  while (offset + 4 <= buf.length) {
    const size = buf.readInt32LE(offset);
    if (size < 10 || offset + 4 + size > buf.length) break;
    const id = buf.readInt32LE(offset + 4);
    const type = buf.readInt32LE(offset + 8);
    const body = buf.slice(offset + 12, offset + 4 + size - 2).toString("utf8");
    packets.push({ id, type, body });
    offset += 4 + size;
  }
  return { packets, rest: buf.slice(offset) };
}

function rconExec(port, password, command) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: "127.0.0.1", port: Number(port) || 25575 });
    let buf = Buffer.alloc(0);
    let authed = false;
    const reqId = 1;
    const timer = setTimeout(() => {
      sock.destroy();
      resolve({ ok: false, error: "RCON timed out" });
    }, 8000);
    sock.on("connect", () => sock.write(rconPacket(reqId, 3, password || "")));
    sock.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const { packets, rest } = takeRconPackets(buf);
      buf = rest;
      for (const p of packets) {
        if (!authed) {
          if (p.id === -1) {
            clearTimeout(timer);
            sock.destroy();
            resolve({ ok: false, error: "RCON auth failed. Check AdminPassword and RCONEnabled." });
            return;
          }
          if (p.id === reqId) {
            authed = true;
            sock.write(rconPacket(reqId + 1, 2, String(command || "")));
          }
          continue;
        }
        clearTimeout(timer);
        sock.end();
        resolve({ ok: true, body: p.body || "(empty)" });
        return;
      }
    });
    sock.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message || "RCON socket error" });
    });
  });
}

export function registerHost(ipcMain, { getWindow, app, Tray, Menu, nativeImage, shell }) {
  ipcMain.handle("palnest:detect-steam", () => detectSteam());
  ipcMain.handle("palnest:detect-agents", () => detectAgents());
  ipcMain.handle("palnest:write-file", (_e, p, contents) => writeFile(p, contents));
  ipcMain.handle("palnest:spawn-pal", (_e, id, exe, argv, cwd) =>
    spawnTracked(pals, id, exe, argv || [], cwd, (row) => send(getWindow, "palnest:console", row)),
  );
  ipcMain.handle("palnest:stop-pal", (_e, id) => killTracked(pals, id));
  ipcMain.handle("palnest:pal-metrics", (_e, id) => palMetrics(id));
  ipcMain.handle("palnest:steamcmd", (_e, argv, cwd) => {
    const bin = process.platform === "win32" ? "steamcmd.exe" : "steamcmd";
    return spawnTracked(
      new Map(),
      "steamcmd",
      bin,
      argv || [],
      cwd,
      (row) => send(getWindow, "palnest:console", { ...row, id: "steamcmd" }),
      true,
    );
  });
  ipcMain.handle("palnest:extract-zip", (_e, zip, dest) => extractZip(zip, dest));
  ipcMain.handle("palnest:zip-dir", (_e, src, dest) => zipDir(src, dest));
  ipcMain.handle("palnest:restore-zip", (_e, zip, dest) => restoreZip(zip, dest));
  ipcMain.handle("palnest:enable-mod", (_e, p, kind, on) => enableMod(p, kind, on));
  ipcMain.handle("palnest:rest", (_e, url, method, body, user, pass) => restCall(url, method, body, user, pass));
  ipcMain.handle("palnest:rcon", (_e, port, password, command) => rconExec(port, password, command));
  ipcMain.handle("palnest:upnp", (_e, port, on) => upnp(port, on));
  ipcMain.handle("palnest:udp-listen", (_e, port) => udpListen(port));
  ipcMain.handle("palnest:spawn-agent", (_e, kind, argv, cwd) =>
    spawnAgent(kind, argv, cwd, (row) => send(getWindow, "palnest:console", { ...row, id: kind })),
  );
  ipcMain.handle("palnest:stop-agent", (_e, kind) => killTracked(agents, kind));
  ipcMain.handle("palnest:launch-game", (_e, exe, connect) => {
    const argv = connect ? [`-connect=${connect}`] : [];
    return spawnTracked(new Map(), "game", exe, argv, path.dirname(exe));
  });
  ipcMain.handle("palnest:autostart", (_e, on) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(on), path: app.getPath("exe") });
    return Boolean(on);
  });
  ipcMain.handle("palnest:set-tray", (_e, on) => {
    closeToTray = Boolean(on);
    if (!on) {
      tray?.destroy();
      tray = null;
      return false;
    }
    if (tray) return true;
    try {
      const iconPath = path.join(path.dirname(new URL(import.meta.url).pathname), "resources", "icon.png");
      const img = nativeImage?.createFromPath?.(iconPath);
      tray = new Tray(img && !img.isEmpty?.() ? img : iconPath);
      tray.setToolTip("Palnest");
      tray.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Show Palnest", click: () => getWindow()?.show() },
          { type: "separator" },
          { label: "Quit Palnest", click: () => {
              app.isQuiting = true;
              const win = getWindow();
              if (win && !win.isDestroyed()) win.close();
              app.quit();
            } },
        ]),
      );
      tray.on("click", () => getWindow()?.show());
      return true;
    } catch {
      return false;
    }
  });
  ipcMain.handle("palnest:notify", (_e, title, body) => {
    try {
      if (tray?.displayBalloon) {
        tray.displayBalloon({ title: title || "Palnest", content: String(body || "") });
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  });

  app.setAsDefaultProtocolClient("palnest");
  app.on("open-url", (event, url) => {
    event.preventDefault();
    send(getWindow, "palnest:deep-link", url);
  });
}

export function shouldCloseToTray() {
  return closeToTray;
}

export function stopAllHost() {
  for (const id of [...pals.keys()]) killTracked(pals, id);
  for (const id of [...agents.keys()]) killTracked(agents, id);
  tray?.destroy();
  tray = null;
}
