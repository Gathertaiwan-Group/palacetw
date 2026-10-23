import { db } from "./supabase";
import { type SiteIndex, type Post, visibleProducts, getContent } from "./data";

/** WordPress search over published posts, pages and products: title matches first, then content/excerpt, newest first. */
export async function search(ix: SiteIndex, q: string): Promise<Post[]> {
  const term = q.trim();
  const candidates = [...ix.posts.filter((p) => p.status === "publish" && (p.post_type === "post" || p.post_type === "page")), ...visibleProducts(ix, "search")];
  if (!term) return candidates.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  const like = `%${term.replace(/[%_,()]/g, " ")}%`;
  const { data } = await db().from("posts").select("id").eq("status", "publish").in("post_type", ["post", "page", "product"]).or(`title.ilike.${like},content.ilike.${like},excerpt.ilike.${like}`).limit(500);
  const hit = new Set((data || []).map((r: { id: number }) => r.id));
  // Pages whose only match is inside rendered product shortcodes ([products] grids) did not match on the
  // old site, because WordPress searched the raw shortcode, not its output.
  const t0 = term.toLowerCase();
  for (const p of ix.posts.filter((x) => (x.post_type === "page" || x.post_type === "post") && hit.has(x.id))) {
    if (p.title.toLowerCase().includes(t0) || p.excerpt.toLowerCase().includes(t0)) continue;
    // drop rendered product grids (balanced <ul class="products ...">) and compare visible text only: oEmbed iframe
    // titles and image alts are generated at render time and were not part of the raw post_content WordPress searched
    const c = stripBalanced((await getContent(p.id)), /<ul\s[^>]*class="[^"]*\bproducts\b[^"]*"[^>]*>/g, "ul");
    if (!c.replace(/<[^>]+>/g, " ").toLowerCase().includes(t0)) hit.delete(p.id);
  }
  const shortHit = new Set(ix.products.filter((p) => p.short_description.toLowerCase().includes(term.toLowerCase())).map((p) => p.post_id));
  const res = candidates.filter((p) => hit.has(p.id) || shortHit.has(p.id));
  const t = term.toLowerCase();
  const byDate = (a: Post, b: Post) => (b.published_at || "").localeCompare(a.published_at || "") || b.id - a.id;
  const inTitle = res.filter((p) => p.title.toLowerCase().includes(t)).sort(byDate);
  const rest = res.filter((p) => !p.title.toLowerCase().includes(t)).sort(byDate);
  return [...inTitle, ...rest];
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
