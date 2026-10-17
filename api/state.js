import crypto from "node:crypto";
import "../public/merge.js";
import { readDb, writeDb } from "../store.js";

const { mergeShared } = globalThis.Merge;
const MAX_BODY = 3.5 * 1024 * 1024;

const same = (a, b) => {
  if (!a || !b) return false;
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Chave do Davi: a salva no banco (trocada/desativada pelo dono) vale mais que a variável de ambiente inicial.
const daviKey = db => (db.keys && db.keys.davi !== undefined ? db.keys.davi : process.env.DAVI_KEY || null);
const roleOf = (db, key) => {
  if (same(key, process.env.OWNER_KEY)) return "owner";
  const d = daviKey(db);
  return d && same(key, d) ? "davi" : null;
};

// O Davi só recebe estoque e manutenções. Nada do restante do painel sai daqui.
function view(db, role) {
  const out = { role, rev: db.rev || 0, stock: db.stock || null, maint: db.maint || null };
  if (role === "owner") {
    out.core = db.core || null;
    const k = daviKey(db);
    out.davi = { active: !!k, key: k || null };
  }
  return out;
}

const validDoc = d => d && typeof d === "object" && Array.isArray(d.items) && d.items.every(i => i && typeof i.id === "string");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const send = (code, obj) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
  try {
    const db = (await readDb()) || { rev: 0 };
    const role = roleOf(db, req.headers["x-key"]);
    if (!role) return send(401, { error: "unauthorized" });
    const action = new URL(req.url, "http://x").searchParams.get("a");

    if (req.method === "GET") return send(200, view(db, role));

    if (req.method === "POST" && (action === "rotate" || action === "revoke")) {
      if (role !== "owner") return send(403, { error: "forbidden" });
      db.keys = { ...(db.keys || {}), davi: action === "rotate" ? crypto.randomBytes(24).toString("base64url") : null };
      await writeDb(db);
      return send(200, view(db, role));
    }

    if (req.method === "PUT") {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);
      if (!body || typeof body !== "object" || JSON.stringify(body).length > MAX_BODY) return send(400, { error: "bad body" });
      if (role === "owner" && body.core && typeof body.core === "object" && (!db.core || (+body.core.u || 0) >= (+db.core.u || 0))) db.core = body.core;
      if (validDoc(body.stock)) db.stock = mergeShared(db.stock, body.stock, role === "davi");
      if (validDoc(body.maint)) db.maint = mergeShared(db.maint, body.maint, role === "davi");
      db.rev = (db.rev || 0) + 1;
      await writeDb(db);
      return send(200, view(db, role));
    }

    return send(405, { error: "method not allowed" });
  } catch (e) {
    console.error(e);
    return send(500, { error: "server error" });
  }
}
