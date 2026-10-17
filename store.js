// Armazenamento: Vercel Blob privado em produção; arquivo local só para testes (LOCAL_DB).
import fs from "node:fs/promises";

const PATHNAME = "state.json";

export async function readDb() {
  if (process.env.LOCAL_DB) {
    try { return JSON.parse(await fs.readFile(process.env.LOCAL_DB, "utf8")); } catch { return null; }
  }
  const { get } = await import("@vercel/blob");
  const r = await get(PATHNAME, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function writeDb(db) {
  const body = JSON.stringify(db);
  if (process.env.LOCAL_DB) return fs.writeFile(process.env.LOCAL_DB, body);
  const { put } = await import("@vercel/blob");
  await put(PATHNAME, body, { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" });
}
