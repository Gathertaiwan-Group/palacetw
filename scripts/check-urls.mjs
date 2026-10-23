#!/usr/bin/env node
// Verifies every old-site URL (export/urls.json) answers 200 on the new site, and attachment URLs 301 to files.
// Usage: EXPORT_DIR=../export BASE=http://localhost:3100 node scripts/check-urls.mjs
import fs from "node:fs";
import path from "node:path";
const EXPORT_DIR = path.resolve(process.env.EXPORT_DIR || "../export");
const BASE = (process.env.BASE || "http://localhost:3100").replace(/\/$/, "");
const { urls } = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "urls.json"), "utf8"));
let ok = 0; const bad = [];
for (const u of urls) {
  const url = typeof u === "string" ? u : u.url;
  const p = new URL(url);
  const r = await fetch(BASE + p.pathname + p.search, { redirect: "manual" });
  if (r.status === 200) ok++; else bad.push(`${r.status} ${decodeURIComponent(p.pathname)}`);
}
console.log(`urls.json: ${ok}/${urls.length} -> 200`);
bad.forEach((b) => console.log("  FAIL", b));
// attachment pages
const media = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "rest/media.json"), "utf8"));
let a301 = 0; const abad = [];
for (const m of media) {
  const r = await fetch(`${BASE}/?attachment_id=${m.id}`, { redirect: "manual" });
  const loc = r.headers.get("location") || "";
  if ((r.status === 301 || r.status === 308) && /\/storage\/v1\/object\/public\/site-palacetw\//.test(loc)) a301++; else abad.push(`${r.status} ${m.id}`);
}
console.log(`attachments: ${a301}/${media.length} -> 301 to file`);
abad.slice(0, 10).forEach((b) => console.log("  FAIL", b));
process.exit(bad.length || abad.length ? 1 : 0);
