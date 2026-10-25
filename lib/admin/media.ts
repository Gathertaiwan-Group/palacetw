import "server-only";
import sharp from "sharp";
import { AdminError, type Actor, audit, must, refreshSite, sb, slugify } from "./core";

export const BUCKET = "site-palacetw";
const MAX_BYTES = 20 * 1024 * 1024;
const PASSTHROUGH = /^(image\/gif|image\/svg\+xml|video\/|audio\/|application\/pdf)/;

export async function listMedia(opts: { search?: string; mime?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 60, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("media").select("id,title,alt_text,caption,mime_type,width,height,filesize,public_url,storage_path,uploaded_at,created_at", { count: "exact" });
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`title.ilike.%${s}%,storage_path.ilike.%${s}%,alt_text.ilike.%${s}%`);
  }
  if (opts.mime) q = q.ilike("mime_type", `${opts.mime}%`);
  const res = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function getMedia(id: number) {
  const m = must(await sb().from("media").select("*").eq("id", id).maybeSingle());
  if (!m) throw new AdminError(`找不到媒體 ${id}`, 404);
  return m as any;
}

function blockedHost(u: URL) {
  const h = u.hostname.toLowerCase();
  return h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h);
}

export async function fetchRemote(url: string) {
  let u: URL;
  try { u = new URL(url); } catch { throw new AdminError("網址格式錯誤"); }
  if (!/^https?:$/.test(u.protocol) || blockedHost(u)) throw new AdminError("不允許的網址");
  const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "GatherMigrator/1.0" } });
  if (!r.ok) throw new AdminError(`下載失敗 HTTP ${r.status}`);
  const len = Number(r.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new AdminError("檔案超過 20MB");
  const buf = Buffer.from(await r.arrayBuffer());
  const name = decodeURIComponent(u.pathname.split("/").pop() || "file");
  return { bytes: buf, filename: name, mime: (r.headers.get("content-type") || "").split(";")[0] };
}

function guessMime(filename: string, given?: string) {
  if (given && given !== "application/octet-stream") return given;
  const ext = filename.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", pdf: "application/pdf", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", heic: "image/heic", tif: "image/tiff", tiff: "image/tiff" };
  return map[ext] || "application/octet-stream";
}

/** Responsive WebP widths (same as scripts/media-variants.mjs); only widths smaller than the stored image are made. */
const VARIANT_WIDTHS = [480, 960, 1440];
const variantPath = (storagePath: string, w: number) => `v/${w}/${storagePath.replace(/\.[^./]+$/, "")}.webp`;

/** Makes and uploads the 480 / 960 / 1440 WebP variants (quality 75, immutable cache) for a raster image. */
export async function makeVariants(source: Buffer, storagePath: string, storedWidth: number | null) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || !storedWidth) return [];
  const out: { w: number; h: number; path: string; url: string; bytes: number }[] = [];
  for (const w of VARIANT_WIDTHS) {
    if (w >= storedWidth) continue;
    const { data, info } = await sharp(source, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer({ resolveWithObject: true });
    const path = variantPath(storagePath, w);
    const enc = path.split("/").map(encodeURIComponent).join("/");
    const r = await fetch(`${base}/storage/v1/object/${BUCKET}/${enc}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/webp", "cache-control": "public, max-age=31536000, immutable", "x-upsert": "true" },
      body: new Uint8Array(data),
    });
    if (!r.ok) throw new AdminError(`上傳縮放版本失敗：${r.status}`, 500);
    out.push({ w: info.width, h: info.height, path, url: sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl, bytes: data.length });
  }
  return out;
}

/** Upload: raster images are converted to WebP (longest side 2000, quality 80); GIF / SVG / video / PDF stay as-is. */
export async function uploadMedia(actor: Actor, file: { bytes: Buffer; filename: string; mime?: string }, meta: { title?: string; alt_text?: string; caption?: string; parent_post_id?: number | null } = {}) {
  if (!file.bytes?.length) throw new AdminError("檔案是空的");
  if (file.bytes.length > MAX_BYTES) throw new AdminError("檔案超過 20MB");
  const mime = guessMime(file.filename, file.mime);
  if (mime === "image/svg+xml") throw new AdminError("基於安全考量不接受 SVG");
  const base = slugify(file.filename.replace(/\.[^.]+$/, "")).replace(/%[0-9a-f]{2}/g, "") || `file-${Date.now()}`;
  let out = file.bytes;
  let outMime = mime;
  let ext = (file.filename.split(".").pop() || "bin").toLowerCase();
  let width: number | null = null;
  let height: number | null = null;
  if (mime.startsWith("image/") && !PASSTHROUGH.test(mime)) {
    const img = sharp(file.bytes, { failOn: "error" }).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 });
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    out = data; outMime = "image/webp"; ext = "webp"; width = info.width; height = info.height;
  } else if (mime === "image/gif") {
    const m = await sharp(file.bytes).metadata().catch(() => null);
    width = m?.width ?? null; height = m?.pageHeight ?? m?.height ?? null;
  } else if (!PASSTHROUGH.test(mime)) {
    throw new AdminError(`不支援的檔案類型 ${mime}`);
  }
  const now = new Date();
  const dir = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let path = `${dir}/${base}.${ext}`;
  for (let i = 1; i < 100; i++) {
    const { data } = await sb().from("media").select("id").eq("storage_path", path).maybeSingle();
    if (!data) break;
    path = `${dir}/${base}-${i}.${ext}`;
  }
  const up = await sb().storage.from(BUCKET).upload(path, out, { contentType: outMime, upsert: false, cacheControl: "31536000" });
  if (up.error) throw new AdminError(`上傳失敗：${up.error.message}`, 500);
  const public_url = sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const variants = outMime === "image/webp" ? await makeVariants(file.bytes, path, width) : [];
  const row = must(await sb().from("media").insert({
    variants,
    slug: base, title: meta.title ?? file.filename.replace(/\.[^.]+$/, ""), alt_text: meta.alt_text ?? "", caption: meta.caption ?? "",
    mime_type: outMime, original_mime: mime, width, height, filesize: out.length, original_filesize: file.bytes.length,
    storage_path: path, public_url, parent_post_id: meta.parent_post_id ?? null, in_library: true, uploaded_at: now.toISOString(),
  }).select("*").single()) as any;
  await audit(actor, "media.upload", "media", row.id, null, { storage_path: path, mime_type: outMime, filesize: out.length, original_filesize: file.bytes.length });
  refreshSite();
  return row;
}

export async function updateMedia(actor: Actor, id: number, input: { title?: string; alt_text?: string; caption?: string; description?: string }) {
  const before = await getMedia(id);
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "alt_text", "caption", "description"] as const) if (input[k] !== undefined) patch[k] = input[k];
  const after = must(await sb().from("media").update(patch).eq("id", id).select("*").single());
  await audit(actor, "media.update", "media", id, { title: before.title, alt_text: before.alt_text, caption: before.caption }, patch);
  refreshSite();
  return after;
}

export async function deleteMedia(actor: Actor, id: number) {
  const before = await getMedia(id);
  const { data: users } = await sb().from("posts").select("id").eq("featured_media_id", id).limit(5);
  const variantPaths = (Array.isArray(before.variants) ? before.variants : []).map((v: { path?: string }) => v.path).filter(Boolean) as string[];
  const rm = await sb().storage.from(BUCKET).remove([before.storage_path, ...variantPaths]);
  if (rm.error) throw new AdminError(`刪除檔案失敗：${rm.error.message}`, 500);
  must(await sb().from("media").delete().eq("id", id));
  await audit(actor, "media.delete", "media", id, { storage_path: before.storage_path, public_url: before.public_url, featured_on: (users || []).map((u: any) => u.id) }, null);
  refreshSite();
  return { id, deleted: true };
}
