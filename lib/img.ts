import type { Media, SiteIndex } from "./data";

/**
 * Responsive images. media.variants holds WebP copies 480 / 960 / 1440 px wide (scripts/media-variants.mjs and
 * lib/admin/media.ts); the stored image itself (≤ 2000 px) is the largest srcset candidate.
 */
export type Variant = { w: number; h: number; url: string; path?: string; bytes?: number };

/** Typical display widths (CSS px) used in `sizes` */
export const SIZES = {
  card: "(max-width: 480px) 50vw, (max-width: 960px) 33vw, 265px", // WooCommerce product loop
  thumb: "100px",
  product: "(max-width: 768px) 100vw, 600px", // single product main image
  full: "(max-width: 1200px) 100vw, 1200px",
  blogCard: "(max-width: 768px) 100vw, 50vw",
};

function variantsOf(m: Pick<Media, "variants">): Variant[] {
  return (Array.isArray(m.variants) ? m.variants : []).filter((v) => v && v.url && v.w).sort((a, b) => a.w - b.w);
}

export function srcSetOf(m: Media): string | undefined {
  const vs = variantsOf(m);
  if (!vs.length) return undefined;
  const list = vs.map((v) => `${v.url} ${v.w}w`);
  if (m.width && m.width > vs[vs.length - 1].w) list.push(`${m.public_url} ${m.width}w`);
  return list.join(", ");
}

/** Smallest stored version at least `minWidth` px wide (falls back to the stored image). */
export function variantUrl(m: Media | null | undefined, minWidth: number): string | null {
  if (!m) return null;
  const v = variantsOf(m).find((x) => x.w >= minWidth);
  return v ? v.url : m.public_url;
}

/** Props for an <img>: srcset / sizes / intrinsic size / lazy unless it is the above-the-fold main image. */
export function imgProps(m: Media, sizes: string, opts: { priority?: boolean; width?: number; height?: number } = {}) {
  const width = opts.width ?? m.width ?? undefined;
  const height = opts.height ?? (opts.width && m.width && m.height ? Math.round((opts.width * m.height) / m.width) : m.height ?? undefined);
  return {
    src: m.public_url,
    srcSet: srcSetOf(m),
    sizes: srcSetOf(m) ? sizes : undefined,
    width,
    height,
    loading: opts.priority ? undefined : ("lazy" as const),
    decoding: "async" as const,
    fetchPriority: opts.priority ? ("high" as const) : undefined,
  };
}

/* ---------- images inside stored HTML (post content, short descriptions, term descriptions) ---------- */

const mapCache = new WeakMap<SiteIndex, Map<string, Media>>();
function mediaByUrl(ix: SiteIndex) {
  let map = mapCache.get(ix);
  if (!map) {
    map = new Map();
    for (const m of ix.media) {
      if (!m.public_url) continue;
      map.set(m.public_url, m);
      try { map.set(decodeURI(m.public_url), m); } catch { /* keep raw */ }
    }
    mapCache.set(ix, map);
  }
  return map;
}

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
};

/**
 * Adds srcset / sizes (and width / height / loading / decoding when missing) to every <img> whose src is a media
 * library file. `sizes` follows WordPress: (max-width: Wpx) 100vw, Wpx for an image rendered at width W.
 */
export function responsiveHtml(ix: SiteIndex, html: string | null | undefined): string {
  if (!html || !html.includes("<img")) return html || "";
  const map = mediaByUrl(ix);
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = attr(tag, "src");
    if (!src) return tag;
    const clean = src.replace(/&amp;/g, "&").split("?")[0];
    let m = map.get(clean);
    if (!m) { try { m = map.get(decodeURI(clean)); } catch { /* ignore */ } }
    if (!m) return tag;
    const add: string[] = [];
    const set = srcSetOf(m);
    const w = Number(attr(tag, "width")) || 0;
    if (set && attr(tag, "srcset") === null) {
      add.push(`srcset="${set}"`);
      if (attr(tag, "sizes") === null) add.push(`sizes="${w ? `(max-width: ${w}px) 100vw, ${w}px` : "100vw"}"`);
    }
    if (!w && !attr(tag, "height") && m.width && m.height) add.push(`width="${m.width}" height="${m.height}"`);
    if (attr(tag, "loading") === null && !/fetchpriority\s*=\s*["']?high/i.test(tag)) add.push(`loading="lazy"`);
    if (attr(tag, "decoding") === null) add.push(`decoding="async"`);
    if (!add.length) return tag;
    return tag.replace(/^<img\b/i, `<img ${add.join(" ")}`);
  });
}
