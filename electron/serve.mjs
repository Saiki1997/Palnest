#!/usr/bin/env node
/**
 * Local den for the packaged Windows app. Serves Nitro static assets, then
 * falls through to the Vercel-built fetch handler so SSR + server functions work
 * without Vercel.
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const host = process.env.HOST || process.env.NITRO_HOST || "127.0.0.1";
const port = Number(process.env.PORT || process.env.NITRO_PORT || 47821);
const root = resolve(process.env.PALNEST_HOST_ROOT || process.cwd());
const staticDir = join(root, "static");
const nitroPath = join(root, "functions", "__server.func", "index.mjs");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.end(body);
}

function safeStatic(pathname) {
  const rel = decodeURIComponent(pathname.split("?")[0] || "/").replace(/^\/+/, "");
  if (!rel || rel.includes("\0")) return null;
  const full = normalize(join(staticDir, rel));
  const rootWithSep = staticDir.endsWith(sep) ? staticDir : staticDir + sep;
  if (full !== staticDir && !full.startsWith(rootWithSep)) return null;
  try {
    const st = statSync(full);
    if (st.isFile()) return full;
  } catch {
    return null;
  }
  return null;
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 80 * 1024 * 1024) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolveBody(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const nitroMod = await import(pathToFileURL(nitroPath).href);
const nitroFetch = nitroMod.default?.fetch || nitroMod.fetch;
if (typeof nitroFetch !== "function") {
  throw new Error("Palnest den is missing a fetch handler.");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
    const file = safeStatic(url.pathname);
    if (file) {
      res.statusCode = 200;
      res.setHeader("content-type", MIME[extname(file).toLowerCase()] || "application/octet-stream");
      res.setHeader("cache-control", url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
      createReadStream(file).pipe(res);
      return;
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      headers.set(key, Array.isArray(value) ? value.join(", ") : String(value));
    }

    const init = { method: req.method || "GET", headers };
    if (req.method && !/^(GET|HEAD)$/i.test(req.method)) {
      init.body = new Uint8Array(await readBody(req));
    }

    const response = await nitroFetch(new Request(url, init), {});
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (err) {
    if (!res.headersSent) send(res, 500, err instanceof Error ? err.message : "den failed");
  }
});

if (!existsSync(nitroPath)) {
  throw new Error(`Missing den at ${nitroPath}`);
}

server.listen(port, host, () => {
  process.stdout.write(`[palnest] den http://${host}:${port}/\n`);
});
