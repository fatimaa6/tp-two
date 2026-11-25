/**
 * Serveur local minimal : sert dist/ et route /api/* vers le même routeur que la fonction Netlify.
 * Sert aux tests de bout en bout en CI sans Netlify CLI. Pour le développement, `netlify dev` reste possible.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { handle } from "../src/server/http/router";
import { getDeps } from "../src/server/runtime";

const PORT = Number(process.env.PORT ?? 8888);
const DIST = path.resolve("dist");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
  ".map": "application/json",
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
    // Équivalent local de l'en-tête x-nf-client-connection-ip ajouté par Netlify.
    headers.set("x-nf-client-connection-ip", req.socket.remoteAddress ?? "unknown");
    const r = await handle(
      new Request(url, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
      }),
      getDeps(),
    );
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  const file = path.join(DIST, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
  try {
    const body = await readFile(
      file.endsWith(path.sep) || !path.extname(file) ? path.join(DIST, "index.html") : file,
    );
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "text/html; charset=utf-8" });
    res.end(body);
  } catch {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(path.join(DIST, "index.html")));
  }
}).listen(PORT, () => console.info(`Studio Sillage en local : http://localhost:${PORT}`));
