// Minimal static server for local use and browser tests. Usage: PORT=8787 node scripts/serve.mjs [dir]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const ROOT = process.argv[2] || "public";
const PORT = Number(process.env.PORT || 8787);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".map": "application/json", ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv" };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "cache-control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); }
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`));
