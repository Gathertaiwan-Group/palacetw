#!/usr/bin/env node
/**
 * Responsive image variants for site_palacetw.media.
 *   node scripts/media-variants.mjs [--export ~/gather-migrate/palacetw/export] [--force] [--only <id,id>]
 * For every raster image (not GIF/SVG) it makes WebP versions 480 / 960 / 1440 px wide (quality 75, never upscaled:
 * only widths smaller than the stored image), uploads them to bucket site-palacetw at v/<w>/<storage path>.webp with
 * `cache-control: public, max-age=31536000, immutable`, and records them in media.variants.
 * Source = the original file from the WordPress export (matched by media.old_url) when present, otherwise the stored
 * object itself (admin / MCP uploads made after the migration).
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";

const WIDTHS = [480, 960, 1440];
const BUCKET = "site-palacetw";
const SCHEMA = "site_palacetw";
const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FORCE = args.includes("--force");
const ONLY = opt("--only") ? new Set(opt("--only").split(",").map(Number)) : null;
const EXPORT = (opt("--export") || path.join(os.homedir(), "gather-migrate/palacetw/export")).replace(/^~/, os.homedir());

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = async (p, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, "Accept-Profile": SCHEMA, "Content-Profile": SCHEMA, "Content-Type": "application/json", ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

const index = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(EXPORT, "media/index.json"), "utf8")); } catch { return []; }
})();
const localByUrl = new Map(index.filter((e) => e.local).map((e) => [e.url, path.join(EXPORT, e.local)]));

export const variantPath = (storagePath, w) => `v/${w}/${storagePath.replace(/\.[^./]+$/, "")}.webp`;
const publicUrl = (p) => `${URL_}/storage/v1/object/public/${BUCKET}/${p.split("/").map(encodeURIComponent).join("/")}`;

async function source(row) {
  const local = row.old_url && localByUrl.get(row.old_url);
  if (local && fs.existsSync(local)) return { buf: fs.readFileSync(local), from: "export" };
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${row.storage_path.split("/").map(encodeURIComponent).join("/")}`, { headers: H });
  if (!r.ok) throw new Error(`download ${row.storage_path}: ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), from: "bucket" };
}

async function upload(p, buf) {
  const r = await fetch(`${URL_}/storage/v1/object/${BUCKET}/${p.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-upsert": "true" },
    body: buf,
  });
  if (!r.ok) throw new Error(`upload ${p}: ${r.status} ${await r.text()}`);
}

const rows = await rest("media?select=id,storage_path,old_url,mime_type,width,height,variants&order=id");
const todo = rows.filter((r) => (!ONLY || ONLY.has(r.id)) && /^image\//.test(r.mime_type) && !/gif|svg/.test(r.mime_type) && r.width && (FORCE || !(r.variants || []).length));
let made = 0, bytes = 0, origBytes = 0;
const queue = [...todo];
async function worker() {
  for (let row; (row = queue.shift()); ) {
    const { buf, from } = await source(row);
    const variants = [];
    for (const w of WIDTHS) {
      if (w >= row.width) continue; // never upscale; the stored image itself is the largest candidate
      const { data, info } = await sharp(buf, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
      const p = variantPath(row.storage_path, w);
      await upload(p, data);
      variants.push({ w: info.width, h: info.height, path: p, url: publicUrl(p), bytes: data.length });
      made++; bytes += data.length;
    }
    await rest(`media?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ variants }), headers: { Prefer: "return=minimal" } });
    console.log(`${row.id} ${row.storage_path} [${from}] ${row.width}px -> ${variants.map((v) => `${v.w}:${v.bytes}`).join(" ") || "(no smaller widths)"}`);
  }
}
await Promise.all([1, 2, 3, 4].map(worker));
console.log(`done: ${todo.length} images, ${made} variants, ${(bytes / 1048576).toFixed(2)} MB uploaded`);
