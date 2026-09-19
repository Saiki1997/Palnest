import { readdirSync, createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";
import { isMigrationFile } from "./scripts/migration-plan.mjs";

/** The files `src/lib/db.ts` globs — same directory, same non-recursive scope. */
function hasGlobbedMigrations(root: string): boolean {
  try {
    return readdirSync(join(root, "migrations")).some(isMigrationFile);
  } catch {
    return false;
  }
}

/**
 * Finish PGLite bootstrap during dev-server setup (before traffic). Vite awaits
 * async `configureServer` hooks. Production: `src/lib/db` kicks `ensureDbReady`
 * on import.
 *
 * Vite awaiting the hook puts this on time-to-first-render, so an app with no
 * migrations — no schema to apply — skips it entirely rather than paying for a
 * PGLite instance it never queries.
 */
function pgliteBootstrapPlugin(): Plugin {
  return {
    name: "app-builder:pglite-bootstrap",
    apply: "serve",
    async configureServer(server) {
      if (!hasGlobbedMigrations(server.config.root)) return;
      try {
        const mod = (await server.ssrLoadModule("/src/lib/db.ts")) as {
          ensureDbReady?: () => Promise<void>;
        };
        if (typeof mod.ensureDbReady === "function") {
          await mod.ensureDbReady();
        }
      } catch (err) {
        console.error("[app-builder] DB bootstrap failed:", err);
        throw err;
      }
    },
  };
}

/**
 * Live-preview OAuth popup — handled HERE so the agent never has to create a
 * `/auth/popup` route (and cannot break it by scaffolding a React page that
 * paints the full app shell in the popup).
 *
 * `signIn` (client.ts) opens `/auth/popup?providerId=…` in a top-level window.
 * This middleware runs before TanStack Start, calls `handleAuthPopupRequest`,
 * and returns the 302 / completion HTML. Deployed apps do not use the popup
 * (full-page OAuth redirect), so `apply: "serve"` is enough.
 */
function authPopupPlugin(): Plugin {
  return {
    name: "app-builder:auth-popup",
    apply: "serve",
    configureServer(server) {
      // Register immediately (not in a returned post-hook) so we run BEFORE
      // TanStack Start / the SPA HTML fallback. A model-authored
      // `src/routes/auth/popup.tsx` React page must never win this path.
      server.middlewares.use(async (req, res, next) => {
        try {
          const rawUrl = req.url ?? "";
          const pathOnly = rawUrl.split("?", 1)[0] ?? "";
          if (pathOnly !== "/auth/popup") {
            next();
            return;
          }
          if ((req.method ?? "GET").toUpperCase() !== "GET") {
            res.statusCode = 405;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("Method Not Allowed");
            return;
          }

          const host = String(
            req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost:8080",
          );
          const proto = String(
            req.headers["x-forwarded-proto"] ??
              ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : "http"),
          );
          const requestHeaders = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            if (Array.isArray(value)) {
              for (const v of value) requestHeaders.append(key, v);
            } else {
              requestHeaders.set(key, value);
            }
          }
          // Ensure Host is the public preview host so Better Auth's dynamic
          // baseURL / redirect_uri match the popup origin.
          if (!requestHeaders.has("host")) requestHeaders.set("host", host);

          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: "GET",
            headers: requestHeaders,
          });

          const mod = (await server.ssrLoadModule("/src/lib/auth/popup.server.ts")) as {
            handleAuthPopupRequest: (req: Request) => Promise<Response>;
          };
          const response = await mod.handleAuthPopupRequest(request);

          res.statusCode = response.status;
          // Preserve multiple Set-Cookie headers (OAuth state + session).
          const setCookies =
            typeof response.headers.getSetCookie === "function"
              ? response.headers.getSetCookie()
              : [];
          response.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          for (const cookie of setCookies) {
            res.appendHeader("set-cookie", cookie);
          }
          const body = Buffer.from(await response.arrayBuffer());
          res.end(body);
        } catch (err) {
          console.error("[app-builder] /auth/popup handler failed:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "text/plain; charset=utf-8");
            res.end("auth popup failed");
          }
        }
      });
    },
  };
}

function findDesktopZip(root: string) {
  const dir = join(root, "dist-desktop");
  const named = [join(dir, "Palnest-windows.zip"), join(root, "artifacts", "Palnest-windows.zip")];
  const direct = named.find((p) => existsSync(p));
  if (direct) return direct;
  if (!existsSync(dir)) return null;
  const found = readdirSync(dir).find((f) => f.endsWith(".zip") && /win/i.test(f));
  return found ? join(dir, found) : null;
}

function findDesktopSetup(root: string) {
  const dir = join(root, "dist-desktop");
  const named = [
    join(dir, "Palnest-Setup-1.0.0.exe"),
    join(dir, "Palnest-Setup.exe"),
    join(root, "artifacts", "Palnest-Setup.exe"),
    join(dir, "Palnest-Setup.zip"),
    join(root, "artifacts", "Palnest-Setup.zip"),
  ];
  const direct = named.find((p) => existsSync(p));
  if (direct) return direct;
  if (existsSync(dir)) {
    const exe = readdirSync(dir).find((f) => /\.exe$/i.test(f) && /setup/i.test(f));
    if (exe) return join(dir, exe);
  }
  return findDesktopZip(root);
}

function palnestDesktopDownloadPlugin(): Plugin {
  function attach(
    root: string,
    req: { url?: string; method?: string; headers?: { range?: string; Range?: string } },
    res: {
      statusCode: number;
      setHeader: (k: string, v: string) => void;
      end: (s?: string) => void;
    },
    next: () => void,
  ) {
    const url = (req.url ?? "").split("?")[0];
    if (url === "/downloads/palnest-windows-status") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify({ available: Boolean(findDesktopZip(root) || findDesktopSetup(root)) }));
      return;
    }
    const isSetup = url === "/downloads/palnest-setup";
    const isZip = url === "/downloads/palnest-windows";
    if (!isSetup && !isZip) {
      next();
      return;
    }
    const file = isSetup ? findDesktopSetup(root) : findDesktopZip(root);
    if (!file) {
      res.statusCode = 404;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(isSetup ? "Windows installer is not built yet." : "Windows zip is not built yet.");
      return;
    }
    const stat = statSync(file);
    const isExe = file.toLowerCase().endsWith(".exe");
    const filename = isSetup ? (isExe ? "Palnest-Setup.exe" : "Palnest-Setup.zip") : "Palnest-windows.zip";
    const mime = isExe ? "application/vnd.microsoft.portable-executable" : "application/zip";
    const size = stat.size;
    const rangeHeader = req.headers?.range || req.headers?.Range || "";
    const match = String(rangeHeader).match(/bytes=(\d*)-(\d*)/i);
    let start = 0;
    let end = size - 1;
    let status = 200;
    if (match) {
      if (match[1]) start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end >= size) {
        res.statusCode = 416;
        res.setHeader("content-range", `bytes */${size}`);
        res.end();
        return;
      }
      status = 206;
    }
    const length = end - start + 1;
    res.statusCode = status;
    res.setHeader("content-type", mime);
    res.setHeader("content-length", String(length));
    res.setHeader("accept-ranges", "bytes");
    res.setHeader(
      "content-disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    if (status === 206) res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
    if ((req.method ?? "GET").toUpperCase() === "HEAD") {
      res.end();
      return;
    }
    const stream = createReadStream(file, { start, end });
    stream.on("error", () => {
      if (!("headersSent" in res) || !(res as { headersSent?: boolean }).headersSent) {
        res.statusCode = 500;
        res.end("download failed");
      }
    });
    stream.pipe(res as unknown as NodeJS.WritableStream);
  }

  return {
    name: "palnest-desktop-download",
    configureServer(server) {
      server.middlewares.use((req, res, next) => attach(server.config.root, req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => attach(server.config.root, req, res, next));
    },
  };
}

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(({ command, isPreview }) => ({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  build: {
    target: "es2022",
    sourcemap: false,
    cssMinify: true,
    minify: "esbuild",
    reportCompressedSize: false,
    modulePreload: { polyfill: false },
    assetsInlineLimit: 4096,
  },
  esbuild: {
    legalComments: "none",
    drop: command === "build" ? ["debugger"] : [],
  },
  plugins: [
    pgliteBootstrapPlugin(),
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    authPopupPlugin(),
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    palnestDesktopDownloadPlugin(),
    tailwindcss(),
    tanstackStart(),
    ...(command === "build" || isPreview
      ? [
          nitro({
            preset: process.env.NITRO_PRESET || "vercel",
            // Auto-registers server/middleware/* (the PWA install page +
            // manifest + head-tag middleware). Nitro v3 defaults serverDir to
            // false, so removing this silently unwires /?install=1 on deploys.
            serverDir: "./server",
            sourceMap: false,
            minify: true,
            ...(process.env.NITRO_OUTPUT ? { output: { dir: process.env.NITRO_OUTPUT } } : {}),
          }),
        ]
      : []),
    viteReact(),
  ],
}));
