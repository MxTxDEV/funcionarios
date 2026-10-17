// Servidor local só para testes: node dev-server.js  (usa um arquivo em vez do Vercel Blob)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.LOCAL_DB ||= "/tmp/equipe-dev-db.json";
process.env.OWNER_KEY ||= "dono-dev";
process.env.DAVI_KEY ||= "davi-dev";
const { default: handler } = await import("./api/state.js");
const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript" };

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/state") {
    let b = ""; for await (const c of req) b += c;
    req.body = b ? JSON.parse(b) : undefined;
    return handler(req, res);
  }
  const f = path.join(pub, u.pathname === "/" ? "index.html" : path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, ""));
  if (!f.startsWith(pub) || !fs.existsSync(f)) { res.statusCode = 404; return res.end("404"); }
  res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream");
  fs.createReadStream(f).pipe(res);
}).listen(+process.env.PORT || 3111, () => console.log("http://localhost:" + (process.env.PORT || 3111)));
