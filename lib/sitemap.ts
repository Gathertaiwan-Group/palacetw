import { getIndex, published, link, mediaById, visibleProducts, objectsInTerm, blogPosts, termLink, type SiteIndex } from "./data";
import { abs, SITE_URL } from "./site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const iso = (s: string | null | undefined) => (s ? new Date(s).toISOString().replace(/\.\d{3}Z$/, "+00:00") : "");

type Entry = { loc: string; lastmod?: string | null; images?: string[] };

export async function entries(kind: string): Promise<Entry[]> {
  const ix: SiteIndex = await getIndex();
  if (kind === "page") return published(ix, "page").map((p) => ({ loc: abs(link(p)), lastmod: p.modified_at || p.published_at }));
  if (kind === "post") {
    const posts = blogPosts(ix);
    const blog = ix.posts.find((p) => p.id === 31);
    return [...(blog ? [{ loc: abs(link(blog)), lastmod: posts[0]?.modified_at }] : []), ...posts.map((p) => ({ loc: abs(link(p)), lastmod: p.modified_at || p.published_at, images: [mediaById(ix, p.featured_media_id)?.public_url].filter(Boolean) as string[] }))];
  }
  if (kind === "product") {
    const shop = ix.posts.find((p) => p.id === 1035);
    const prods = visibleProducts(ix);
    return [...(shop ? [{ loc: abs(link(shop)), lastmod: prods.map((p) => p.modified_at || "").sort().pop() }] : []), ...prods.map((p) => {
      const pr = ix.products.find((x) => x.post_id === p.id);
      const imgs = [p.featured_media_id, ...(pr?.gallery_image_ids || [])].map((id) => mediaById(ix, id)?.public_url).filter(Boolean) as string[];
      return { loc: abs(link(p)), lastmod: p.modified_at || p.published_at, images: imgs };
    })];
  }
  if (kind === "product_cat" || kind === "category") {
    return ix.terms.filter((t) => t.taxonomy === kind).filter((t) => {
      const ids = objectsInTerm(ix, t.id);
      return ix.posts.some((p) => ids.has(p.id) && p.status === "publish");
    }).map((t) => ({ loc: abs(termLink(t)) }));
  }
  return [];
}

export function urlset(list: Entry[]) {
  const body = list.map((e) => `\t<url>\n\t\t<loc>${esc(e.loc)}</loc>\n${e.lastmod ? `\t\t<lastmod>${iso(e.lastmod)}</lastmod>\n` : ""}${(e.images || []).map((i) => `\t\t<image:image>\n\t\t\t<image:loc>${esc(i)}</image:loc>\n\t\t</image:image>\n`).join("")}\t</url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`;
}

export async function sitemapIndex() {
  const kinds = ["post", "page", "product", "product_cat", "category"];
  const parts: string[] = [];
  for (const k of kinds) {
    const list = await entries(k);
    if (!list.length) continue;
    const last = list.map((e) => e.lastmod || "").sort().pop();
    parts.push(`\t<sitemap>\n\t\t<loc>${SITE_URL}/${k}-sitemap.xml</loc>\n${last ? `\t\t<lastmod>${iso(last)}</lastmod>\n` : ""}\t</sitemap>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${parts.join("\n")}\n</sitemapindex>\n`;
}

export const xml = (s: string) => new Response(s, { headers: { "content-type": "application/xml; charset=UTF-8", "x-robots-tag": "noindex, follow" } });
