const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("palnestDesktop", {
  isDesktop: true,
  pickFolder: () => ipcRenderer.invoke("palnest:pick-folder"),
  openPath: (target) => ipcRenderer.invoke("palnest:open-path", target),
  version: () => ipcRenderer.invoke("palnest:version"),
  scanInstall: (root) => ipcRenderer.invoke("palnest:scan-install", root),
  detectSteam: () => ipcRenderer.invoke("palnest:detect-steam"),
  detectAgents: () => ipcRenderer.invoke("palnest:detect-agents"),
  writeFile: (path, contents) => ipcRenderer.invoke("palnest:write-file", path, contents),
  spawnPal: (id, exe, argv, cwd) => ipcRenderer.invoke("palnest:spawn-pal", id, exe, argv, cwd),
  stopPal: (id) => ipcRenderer.invoke("palnest:stop-pal", id),
  palMetrics: (id) => ipcRenderer.invoke("palnest:pal-metrics", id),
  steamcmd: (argv, cwd) => ipcRenderer.invoke("palnest:steamcmd", argv, cwd),
  extractZip: (zip, dest) => ipcRenderer.invoke("palnest:extract-zip", zip, dest),
  zipDir: (src, dest) => ipcRenderer.invoke("palnest:zip-dir", src, dest),
  restoreZip: (zip, dest) => ipcRenderer.invoke("palnest:restore-zip", zip, dest),
  enableMod: (path, kind, on) => ipcRenderer.invoke("palnest:enable-mod", path, kind, on),
  rest: (url, method, body, user, pass) => ipcRenderer.invoke("palnest:rest", url, method, body, user, pass),
  upnp: (port, on) => ipcRenderer.invoke("palnest:upnp", port, on),
  spawnAgent: (kind, argv, cwd) => ipcRenderer.invoke("palnest:spawn-agent", kind, argv, cwd),
  stopAgent: (kind) => ipcRenderer.invoke("palnest:stop-agent", kind),
  launchGame: (exe, connect) => ipcRenderer.invoke("palnest:launch-game", exe, connect),
  autostart: (on) => ipcRenderer.invoke("palnest:autostart", on),
  setTray: (on) => ipcRenderer.invoke("palnest:set-tray", on),
  notify: (title, body) => ipcRenderer.invoke("palnest:notify", title, body),
  udpListen: (port) => ipcRenderer.invoke("palnest:udp-listen", port),
  onConsole: (fn) => {
    const listener = (_e, row) => fn(row);
    ipcRenderer.on("palnest:console", listener);
    return () => ipcRenderer.removeListener("palnest:console", listener);
  },
  onDeepLink: (fn) => {
    const listener = (_e, url) => fn(url);
    ipcRenderer.on("palnest:deep-link", listener);
    return () => ipcRenderer.removeListener("palnest:deep-link", listener);
  },
});
