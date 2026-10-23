export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "台灣宮廷酒廠";

export function abs(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

/** Decode a WordPress (percent-encoded) slug safely. */
export function dec(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** WordPress-style lower-case percent-encoded path for unicode slugs. */
export function enc(s: string) {
  return encodeURIComponent(dec(s)).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

export function stripTags(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
}

/** WordPress zh_TW excerpt (counts characters, 30 by default) */
export function wpExcerpt(html: string, len = 30) {
  const t = stripTags(html);
  return t.length > len ? t.slice(0, len) + "..." : t;
}

/** "7 4 月, 2016" — the date format used by the old theme (j n 月, Y) */
export function wpDate(local: string | null) {
  if (!local) return "";
  const d = new Date(local.replace(" ", "T") + (local.endsWith("Z") ? "" : "Z"));
  return `${d.getUTCDate()} ${d.getUTCMonth() + 1} 月, ${d.getUTCFullYear()}`;
}

export function money(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
