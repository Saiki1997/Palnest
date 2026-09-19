import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, Tray } from "electron";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import { registerHost, shouldCloseToTray, stopAllHost } from "./host.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.PALNEST_DEV_URL || "http://127.0.0.1:8080";
const BACKGROUND = "#0c1110";

app.setName("Palnest");
app.setAppUserModelId("com.palnest.app");

let mainWindow = null;
let nitroChild = null;

function resourceIcon() {
  const packed = path.join(__dirname, "resources", "icon.png");
  return fs.existsSync(packed) ? packed : undefined;
}

function nitroRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "nitro");
  const local = path.join(__dirname, "..", ".output-desktop");
  if (fs.existsSync(path.join(local, "server", "index.mjs"))) return local;
  return path.join(__dirname, "..", ".output");
}

function serverEntry() {
  return path.join(nitroRoot(), "server", "index.mjs");
}

function findFreePort(start = 47821) {
  return new Promise((resolve, reject) => {
    const probe = (port) => {
      const srv = net.createServer();
      srv.unref();
      srv.on("error", (err) => {
        if (port > start + 40) reject(err);
        else probe(port + 1);
      });
      srv.listen(port, "127.0.0.1", () => {
        srv.close(() => resolve(port));
      });
    };
    probe(start);
  });
}

function waitForHttp(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (nitroChild && nitroChild.exitCode != null) {
        reject(
          new Error(
            `The local den exited before it was ready (code ${nitroChild.exitCode}).${tailHint()}`,
          ),
        );
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if ((res.statusCode ?? 500) < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Palnest took too long to start the local den.${tailHint()}`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

let nitroTail = "";

function noteNitro(buf) {
  const text = String(buf);
  nitroTail = (nitroTail + text).slice(-2500);
  process.stdout.write(`[palnest] ${text}`);
}

function tailHint() {
  const text = nitroTail.trim();
  return text ? `\n\n${text.slice(-700)}` : "";
}

function startNitro(port) {
  const entry = serverEntry();
  if (!fs.existsSync(entry)) {
    throw new Error("Palnest server files are missing. Rebuild the Windows package.");
  }
  const cwd = nitroRoot();
  nitroTail = "";
  nitroChild = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NITRO_PORT: String(port),
      PORT: String(port),
      NITRO_HOST: "127.0.0.1",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  nitroChild.stdout?.on("data", noteNitro);
  nitroChild.stderr?.on("data", noteNitro);
  nitroChild.on("exit", (code) => {
    if (code && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox("Palnest", `The local den stopped (code ${code}).${tailHint()}`);
    }
  });
}

function stopNitro() {
  if (!nitroChild || nitroChild.killed) return;
  nitroChild.kill();
  nitroChild = null;
}

async function resolveAppUrl() {
  if (!app.isPackaged && (await ping(DEV_URL))) return DEV_URL;
  const port = await findFreePort();
  startNitro(port);
  const url = `http://127.0.0.1:${port}/`;
  await waitForHttp(url);
  return url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 920,
    minHeight: 640,
    title: "Palnest",
    backgroundColor: BACKGROUND,
    autoHideMenuBar: true,
    show: false,
    icon: resourceIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  void mainWindow.loadURL(url);
  mainWindow.on("close", (e) => {
    if (process.platform === "win32" && !app.isQuiting && shouldCloseToTray()) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("palnest:pick-folder", async () => {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  const res = await dialog.showOpenDialog(win ?? undefined, {
    title: "Choose a Palworld folder",
    properties: ["openDirectory"],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("palnest:open-path", async (_event, target) => {
  if (typeof target !== "string" || !target.trim()) return false;
  const err = await shell.openPath(target.trim());
  return !err;
});

ipcMain.handle("palnest:version", () => app.getVersion());

const SKIP_DIR = /^(SaveGames|Engine|Intermediate|DerivedDataCache|\.git|node_modules|BinariesNoEditor)$/i;

function skipChild(parentName, childName) {
  const parent = parentName.toLowerCase();
  const child = childName.toLowerCase();
  if (SKIP_DIR.test(childName)) return true;
  if (parent === "content") return child !== "paks";
  if (parent === "paks") return !/^~mods$|^mods$|^logicmods$/.test(child);
  if (parent === "saved") return child !== "config";
  if (parent === "win64") return !/^(ue4ss|mods|reshade|reshade-shaders|optiscaler)$/.test(child);
  return false;
}

function resolveInstallRoot(root) {
  const tries = [root, path.join(root, "Palworld"), path.join(root, "PalServer")];
  for (const candidate of tries) {
    if (
      fs.existsSync(path.join(candidate, "Pal", "Binaries")) ||
      fs.existsSync(path.join(candidate, "Pal", "Content"))
    ) {
      return candidate;
    }
  }
  return root;
}

async function walkInstall(root, cap = 8000) {
  const files = [];
  const start = resolveInstallRoot(root);

  async function walk(dir, depth, parentName) {
    if (files.length >= cap || depth > 12) return;
    let entries = [];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= cap) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (skipChild(parentName, entry.name)) continue;
        await walk(full, depth + 1, entry.name);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(start, full);
      const row = { path: rel, size: 0 };
      try {
        const st = await fs.promises.stat(full);
        row.size = st.size;
        if (st.size < 80_000 && /\.(txt|ini|json|md)$/i.test(entry.name)) {
          row.text = await fs.promises.readFile(full, "utf8");
        }
      } catch {
        /* skip */
      }
      files.push(row);
    }
  }

  await walk(start, 0, path.basename(start));
  return files;
}

ipcMain.handle("palnest:scan-install", async (_event, root) => {
  if (typeof root !== "string" || !root.trim()) return [];
  const target = root.trim();
  try {
    const st = await fs.promises.stat(target);
    if (!st.isDirectory()) return [];
  } catch {
    return [];
  }
  return walkInstall(target);
});

registerHost(ipcMain, {
  getWindow: () => mainWindow,
  app,
  Tray,
  Menu,
  nativeImage,
  shell,
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = argv.find((a) => typeof a === "string" && a.startsWith("palnest://"));
    if (link && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("palnest:deep-link", link);
    }
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    try {
      const url = await resolveAppUrl();
      createWindow(url);
    } catch (err) {
      dialog.showErrorBox("Palnest", err instanceof Error ? err.message : String(err));
      app.quit();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform === "win32") return;
  stopNitro();
  stopAllHost();
  app.quit();
});

app.on("before-quit", () => {
  app.isQuiting = true;
  stopNitro();
  stopAllHost();
});
