import { db } from "./supabase";
import { type SiteIndex, type Post, visibleProducts, getContent } from "./data";

/** WordPress search over published posts, pages and products: every search term must match the title, excerpt or
 *  content (WP ANDs the terms), ordered like WP_Query::parse_search_order(). */
export async function search(ix: SiteIndex, q: string): Promise<Post[]> {
  const term = q.trim();
  const candidates = [...ix.posts.filter((p) => p.status === "publish" && (p.post_type === "post" || p.post_type === "page")), ...visibleProducts(ix, "search")];
  if (!term) return candidates.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  const terms = searchTerms(term);
  const sets = await Promise.all((terms.length ? terms : [term.toLowerCase()]).map((t0) => termHits(ix, t0)));
  const res = candidates.filter((p) => sets.every((h) => h.has(p.id)));
  return wpSearchOrder(res, term);
}

async function termHits(ix: SiteIndex, t0: string): Promise<Set<number>> {
  const like = `%${t0.replace(/[%_,()]/g, " ")}%`;
  const { data } = await db().from("posts").select("id").eq("status", "publish").in("post_type", ["post", "page", "product"]).or(`title.ilike.${like},content.ilike.${like},excerpt.ilike.${like}`).limit(500);
  const hit = new Set((data || []).map((r: { id: number }) => r.id));
  // We store rendered HTML, WordPress searched the raw post_content. Two things exist only after rendering and must not
  // match: [products] shortcode grids (<ul class="products ...">) and oEmbed players generated from a bare URL
  // (OceanWP wraps them in <p class="responsive-video-wrap">, e.g. the YouTube iframe titles on product pages).
  // Everything else — including attributes of HTML pasted into the editor, such as a copied WP embed iframe — was raw.
  for (const p of ix.posts.filter((x) => hit.has(x.id))) {
    if (p.title.toLowerCase().includes(t0) || p.excerpt.toLowerCase().includes(t0)) continue;
    let c = stripBalanced(await getContent(p.id), /<ul\s[^>]*class="[^"]*\bproducts\b[^"]*"[^>]*>/g, "ul");
    c = stripBalanced(c, /<p\s[^>]*class="[^"]*\bresponsive-video-wrap\b[^"]*"[^>]*>/g, "p");
    if (!c.toLowerCase().includes(t0) && !decodeEntities(c).toLowerCase().includes(t0)) hit.delete(p.id);
  }
  // WooCommerce stores the short description in post_excerpt
  ix.products.filter((p) => p.short_description.toLowerCase().includes(t0)).forEach((p) => hit.add(p.post_id));
  return hit;
}

/** WP_Query::parse_search_terms(): quoted phrases or space-separated words, de-duplicated. */
export function searchTerms(q: string): string[] {
  const out: string[] = [];
  for (const m of q.matchAll(/"[^"]+"|[^\s"]+/g)) {
    const t = m[0].replace(/^"|"$/g, "").trim().toLowerCase();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * WP_Query::parse_search_order() + "post_date DESC":
 *  - one term:   ORDER BY post_title LIKE '%term%' DESC, post_date DESC
 *  - many terms: CASE sentence-in-title=1, all-words-in-title=2, any-word-in-title=3,
 *                sentence-in-excerpt=4, sentence-in-content=5, else 6; then post_date DESC
 * MySQL resolves equal post_date in primary-key order, so ties go by ID ascending (verified against the old site).
 */
export function wpSearchOrder(res: Post[], q: string): Post[] {
  const sentence = q.trim().toLowerCase();
  const terms = searchTerms(q);
  const rank = (p: Post) => {
    const title = p.title.toLowerCase();
    if (terms.length <= 1) return title.includes(terms[0] ?? sentence) ? 1 : 2;
    if (!/(?:\s|^)-/.test(q) && title.includes(sentence)) return 1;
    if (terms.length < 7) {
      if (terms.every((t) => title.includes(t))) return 2;
      if (terms.some((t) => title.includes(t))) return 3;
    }
    return p.excerpt.toLowerCase().includes(sentence) ? 4 : 5;
  };
  const date = (p: Post) => p.date_local || p.published_at || "";
  return res.map((p) => ({ p, r: rank(p), d: date(p) }))
    .sort((a, b) => a.r - b.r || b.d.localeCompare(a.d) || a.p.id - b.p.id)
    .map((x) => x.p);
}

/** Remove every element whose opening tag matches `open`, together with its (properly nested) contents. */
function stripBalanced(html: string, open: RegExp, tag: string): string {
  let out = "";
  let pos = 0;
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  open.lastIndex = 0;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    if (m.index < pos) continue;
    out += html.slice(pos, m.index);
    tagRe.lastIndex = m.index + m[0].length;
    let depth = 1, end = html.length;
    for (let t = tagRe.exec(html); t; t = tagRe.exec(html)) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) { end = t.index + t[0].length; break; }
    }
    pos = end;
    open.lastIndex = end;
  }
  return out + html.slice(pos);
}

function decodeEntities(s: string) {
  return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
