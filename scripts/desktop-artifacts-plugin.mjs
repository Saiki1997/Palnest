import { existsSync, createReadStream, statSync } from "node:fs";
import { extname, join } from "node:path";

const MIME = {
  ".exe": "application/vnd.microsoft.portable-executable",
  ".zip": "application/zip",
  ".json": "application/json; charset=utf-8",
};

/**
 * Serve built Windows packages from dist-desktop / artifacts / public/desktop
 * during `vite dev` so Settings download buttons work in the live preview
 * without stuffing 100MB+ binaries into the Vercel static output.
 */
export function desktopArtifactsPlugin() {
  const roots = (serverRoot) => [
    join(serverRoot, "public", "desktop"),
    join(serverRoot, "dist-desktop"),
    join(serverRoot, "artifacts"),
  ];

  function resolveFile(serverRoot, name) {
    const safe = name.replace(/\\/g, "/").split("/").pop();
    if (!safe || safe.includes("..")) return null;
    for (const dir of roots(serverRoot)) {
      const full = join(dir, safe);
      if (existsSync(full) && statSync(full).isFile()) return full;
    }
    return null;
  }

  return {
    name: "palnest-desktop-artifacts",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const pathOnly = url.split("?", 1)[0] || "";
        if (!pathOnly.startsWith("/desktop/")) {
          next();
          return;
        }
        const name = decodeURIComponent(pathOnly.slice("/desktop/".length));
        const file = resolveFile(server.config.root, name);
        if (!file) {
          res.statusCode = 404;
          res.setHeader("content-type", "text/plain; charset=utf-8");
          res.end("Windows package is not on this world yet. Run the desktop pack first.");
          return;
        }
        const st = statSync(file);
        res.statusCode = 200;
        res.setHeader("content-type", MIME[extname(file).toLowerCase()] || "application/octet-stream");
        res.setHeader("content-length", String(st.size));
        res.setHeader("content-disposition", `attachment; filename="${name.split("/").pop()}"`);
        res.setHeader("cache-control", "no-store");
        createReadStream(file).pipe(res);
      });
    },
  };
}
