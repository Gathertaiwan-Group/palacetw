#!/usr/bin/env node
// Screenshots the new site for every page in export/screens/index.json and computes a pixel diff vs the old screenshots.
// Usage: EXPORT_DIR=../export BASE=http://localhost:3100 OUT=/tmp/shots TOOLS=~/gather-migrate/_tools node scripts/visual-diff.mjs [filter]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const TOOLS = process.env.TOOLS || path.join(process.env.HOME, "gather-migrate/_tools");
const require = createRequire(path.join(TOOLS, "package.json"));
const { chromium } = require("playwright");
const sharp = require("sharp");
const EXPORT_DIR = path.resolve(process.env.EXPORT_DIR || "../export");
const BASE = (process.env.BASE || "http://localhost:3100").replace(/\/$/, "");
const OUT = path.resolve(process.env.OUT || "/tmp/shots");
const filter = process.argv[2] || "";
fs.mkdirSync(OUT, { recursive: true });
const index = JSON.parse(fs.readFileSync(path.join(EXPORT_DIR, "screens/index.json"), "utf8")).filter((x) => x.file.includes(filter));

async function diff(a, b, outFile) {
  const W = 360; // compare at reduced width to tolerate sub-pixel/font rasterisation differences
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata();
  const ha = Math.round((ma.height * W) / ma.width), hb = Math.round((mb.height * W) / mb.width);
  const H = Math.min(ha, hb);
  const ra = await sharp(a).resize(W, ha).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
  const rb = await sharp(b).resize(W, hb).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
  let differ = 0;
  const vis = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    const d = Math.abs(ra[i * 3] - rb[i * 3]) + Math.abs(ra[i * 3 + 1] - rb[i * 3 + 1]) + Math.abs(ra[i * 3 + 2] - rb[i * 3 + 2]);
    const bad = d > 60;
    if (bad) differ++;
    vis[i * 3] = bad ? 255 : ra[i * 3] * 0.3 + 170; vis[i * 3 + 1] = bad ? 0 : ra[i * 3 + 1] * 0.3 + 170; vis[i * 3 + 2] = bad ? 0 : ra[i * 3 + 2] * 0.3 + 170;
  }
  await sharp(vis, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outFile);
  const heightDelta = Math.abs(ha - hb) / Math.max(ha, hb);
  return { pixelDiff: differ / (W * H), heightOld: ma.height, heightNew: mb.height, heightDelta };
}

// Chrome cannot capture more than ~16384px in one go (taller pages wrap around), so tall pages are captured in strips
async function fullShot(page, file) {
  const { w, h } = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: Math.ceil(document.documentElement.scrollHeight) }));
  if (h <= 12000) return page.screenshot({ path: file, fullPage: true });
  const strips = [];
  for (let y = 0; y < h; y += 6000) {
    const height = Math.min(6000, h - y);
    strips.push({ input: await page.screenshot({ fullPage: true, clip: { x: 0, y, width: w, height } }), left: 0, top: y });
  }
  await sharp({ create: { width: w, height: h, channels: 3, background: "#fff" } }).composite(strips).png().toFile(file);
}

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}).catch(() => chromium.launch({ channel: "chrome" }));
const results = [];
for (const item of index) {
  const u = new URL(item.url);
  const mobile = item.viewport < 800;
  const ctx = await browser.newContext({ viewport: { width: item.viewport, height: mobile ? 844 : 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const target = BASE + u.pathname + u.search;
  let status = 0;
  try {
    const resp = await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
    status = resp?.status() || 0;
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(700);
    await page.addStyleTag({ content: ".pt-chat-bubble,#scroll-top{display:none!important}" });
    const file = path.join(OUT, path.basename(item.file));
    await fullShot(page, file);
    const d = await diff(path.join(EXPORT_DIR, item.file), file, path.join(OUT, path.basename(item.file).replace(".png", "_diff.png")));
    results.push({ name: item.name, viewport: item.viewport, status, ...d, score: d.pixelDiff + d.heightDelta });
  } catch (e) { results.push({ name: item.name, viewport: item.viewport, status, error: String(e).slice(0, 200), score: 9 }); }
  await ctx.close();
}
await browser.close();
results.sort((a, b) => b.score - a.score);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 1));
for (const r of results) console.log(`${r.score.toFixed(3)}  ${r.name}@${r.viewport}  status=${r.status}  px=${(r.pixelDiff ?? 0).toFixed(3)}  h=${r.heightOld}->${r.heightNew}${r.error ? "  ERR " + r.error : ""}`);
