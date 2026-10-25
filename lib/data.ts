import { unstable_cache } from "next/cache";
import { db, admin } from "./supabase";

async function publishDue() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const { data } = await admin().rpc("publish_due");
  return (data as number) || 0;
}
import { dec } from "./site";

export type Post = {
  id: number; post_type: string; status: string; slug: string; path: string | null; title: string; excerpt: string;
  author_id: number | null; parent_id: number | null; menu_order: number; template: string; sticky: boolean;
  comment_status: string; featured_media_id: number | null; published_at: string | null; date_local: string | null;
  modified_at: string | null; seo: Record<string, any>; meta: Record<string, any>;
};
export type Term = { id: number; taxonomy: string; name: string; slug: string; description: string; parent_id: number | null; count: number; old_url: string | null; meta: Record<string, any> };
export type Media = { id: number; title: string; alt_text: string; caption: string; public_url: string; width: number | null; height: number | null; mime_type: string; variants?: { w: number; h: number; url: string }[] };
export type Product = {
  post_id: number; product_type: string; sku: string | null; regular_price: number | null; sale_price: number | null; price: number | null;
  sale_from: string | null; sale_to: string | null; manage_stock: boolean; stock_quantity: number | null; stock_status: string; backorders: string;
  sold_individually: boolean; featured: boolean; catalog_visibility: string; purchasable: boolean; gallery_image_ids: number[];
  upsell_ids: number[]; cross_sell_ids: number[]; short_description: string; total_sales: number; average_rating: number; review_count: number;
  min_qty: number; max_qty: number | null; qty_step: number; external_url: string | null; button_text: string | null; meta: Record<string, any>;
};
export type Variation = {
  id: number; product_id: number; menu_order: number; sku: string | null; attributes: Record<string, string>; description: string;
  regular_price: number | null; sale_price: number | null; price: number | null; manage_stock: boolean; stock_quantity: number | null;
  stock_status: string; image_id: number | null;
};
export type AttrValue = { id: number; product_id: number; attribute_id: number | null; name: string; options: string[]; position: number; visible: boolean; used_for_variations: boolean };
export type QtyRule = { id: number; name: string; scope: string; product_id: number | null; variation_id: number | null; term_id: number | null; min_qty: number; max_qty: number | null; discount_type: string; amount: number; priority: number };
export type MenuItem = { id: number; menu_id: number; parent_id: number | null; position: number; title: string; url: string | null; target: string | null; classes: string[] };

export type SiteIndex = {
  posts: Post[]; terms: Term[]; rels: { object_id: number; term_id: number }[]; media: Media[]; products: Product[];
  variations: Variation[]; attrValues: AttrValue[]; attributes: { id: number; name: string; slug: string }[]; qtyRules: QtyRule[];
  settings: Record<string, any>; menuItems: MenuItem[]; authors: { id: number; slug: string; display_name: string }[];
  commentCounts: Record<number, number>;
};

async function all<T>(table: string, select = "*", order?: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db().from(table).select(select).range(from, from + 999);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data as T[]) || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const POST_COLS = "id,post_type,status,slug,path,title,excerpt,author_id,parent_id,menu_order,template,sticky,comment_status,featured_media_id,published_at,date_local,modified_at,seo,meta";

async function loadIndex(): Promise<SiteIndex> {
  // scheduled posts (status=future) go live once due; the index is rebuilt at most every 300s (and on every admin / MCP write)
  await publishDue().catch(() => 0);
  const [posts, terms, rels, media, products, variations, attrValues, attributes, qtyRules, settingsRows, menuItems, authors, comments] = await Promise.all([
    all<Post>("posts", POST_COLS, "id"),
    all<Term>("terms", "id,taxonomy,name,slug,description,parent_id,count,old_url,meta", "id"),
    all<{ object_id: number; term_id: number }>("term_relationships", "object_id,term_id"),
    all<Media>("media", "id,title,alt_text,caption,public_url,width,height,mime_type,variants", "id"),
    all<Product>("products", "*", "post_id"),
    all<Variation>("product_variations", "id,product_id,menu_order,sku,attributes,description,regular_price,sale_price,price,manage_stock,stock_quantity,stock_status,image_id", "menu_order"),
    all<AttrValue>("product_attribute_values", "*", "position"),
    all<{ id: number; name: string; slug: string }>("product_attributes", "id,name,slug"),
    all<QtyRule>("quantity_discount_rules", "id,name,scope,product_id,variation_id,term_id,min_qty,max_qty,discount_type,amount,priority", "priority"),
    all<{ key: string; value: any }>("settings", "key,value"),
    all<MenuItem>("menu_items", "id,menu_id,parent_id,position,title,url,target,classes", "position"),
    all<{ id: number; slug: string; display_name: string }>("authors", "id,slug,display_name"),
    all<{ post_id: number }>("comments", "post_id"),
  ]);
  const commentCounts: Record<number, number> = {};
  for (const c of comments) commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
  const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  return { posts, terms, rels, media, products, variations, attrValues, attributes, qtyRules, settings, menuItems, authors, commentCounts };
}

export const getIndex = unstable_cache(loadIndex, ["site-index-v2"], { revalidate: 300, tags: ["site"] });

export const getContent = unstable_cache(
  async (id: number) => {
    const { data } = await db().from("posts").select("content").eq("id", id).maybeSingle();
    return (data?.content as string) || "";
  },
  ["post-content-v1"],
  { revalidate: 300, tags: ["site"] },
);

export const getApprovedComments = unstable_cache(
  async (postId: number) => {
    const { data } = await db().from("comments").select("id,parent_id,author_name,author_url,content,created_at,type,rating").eq("post_id", postId).eq("status", "approved").order("created_at");
    return data || [];
  },
  ["post-comments-v1"],
  { revalidate: 300, tags: ["site"] },
);

/* ---------- helpers over the index ---------- */

export function mediaById(ix: SiteIndex, id: number | null | undefined) {
  if (!id) return null;
  return ix.media.find((m) => m.id === id) || null;
}

export function termsOf(ix: SiteIndex, objectId: number, taxonomy: string) {
  const ids = new Set(ix.rels.filter((r) => r.object_id === objectId).map((r) => r.term_id));
  return ix.terms.filter((t) => t.taxonomy === taxonomy && ids.has(t.id));
}

export function objectsInTerm(ix: SiteIndex, termId: number) {
  return new Set(ix.rels.filter((r) => r.term_id === termId).map((r) => r.object_id));
}

export function findTerm(ix: SiteIndex, taxonomy: string, slug: string) {
  const s = dec(slug).toLowerCase();
  return ix.terms.find((t) => t.taxonomy === taxonomy && dec(t.slug).toLowerCase() === s) || null;
}

export function findPost(ix: SiteIndex, types: string[], slug: string) {
  const s = dec(slug).toLowerCase();
  return ix.posts.find((p) => types.includes(p.post_type) && p.status === "publish" && dec(p.slug).toLowerCase() === s) || null;
}

export function published(ix: SiteIndex, type: string) {
  return ix.posts.filter((p) => p.post_type === type && p.status === "publish");
}

/** Posts newest first (WordPress main query order) */
export function blogPosts(ix: SiteIndex) {
  return published(ix, "post").sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "") || b.id - a.id);
}

export function productOf(ix: SiteIndex, id: number) {
  return ix.products.find((p) => p.post_id === id) || null;
}

export function link(p: Pick<Post, "path" | "slug" | "post_type">) {
  if (p.path) return p.path;
  if (p.post_type === "product") return `/product/${p.slug}/`;
  return `/${p.slug}/`;
}

export function termLink(t: Term) {
  const base: Record<string, string> = { category: "category", post_tag: "tag", product_cat: "product-category", product_tag: "product-tag" };
  return `/${base[t.taxonomy] || t.taxonomy}/${t.slug}/`;
}

export function visibleProducts(ix: SiteIndex, ctx: "catalog" | "search" = "catalog") {
  const prods = new Map(ix.products.map((p) => [p.post_id, p]));
  return published(ix, "product").filter((p) => {
    const pr = prods.get(p.id);
    if (!pr) return false;
    if (ctx === "catalog") return pr.catalog_visibility === "visible" || pr.catalog_visibility === "catalog";
    return pr.catalog_visibility === "visible" || pr.catalog_visibility === "search";
  });
}

/** WooCommerce orderby implementation */
export function sortProducts(ix: SiteIndex, list: Post[], orderby: string) {
  const pr = (id: number) => productOf(ix, id);
  const byTitle = (a: Post, b: Post) => a.title.localeCompare(b.title, "en");
  const arr = [...list];
  switch (orderby) {
    case "popularity": return arr.sort((a, b) => (pr(b.id)?.total_sales || 0) - (pr(a.id)?.total_sales || 0) || byTitle(a, b));
    case "rating": return arr.sort((a, b) => Number(pr(b.id)?.average_rating || 0) - Number(pr(a.id)?.average_rating || 0) || byTitle(a, b));
    case "date": return arr.sort((a, b) => (b.published_at || "").localeCompare(a.published_at || "") || b.id - a.id);
    case "price": return arr.sort((a, b) => Number(pr(a.id)?.price ?? 0) - Number(pr(b.id)?.price ?? 0) || byTitle(a, b));
    case "price-desc": return arr.sort((a, b) => Number(pr(b.id)?.price ?? 0) - Number(pr(a.id)?.price ?? 0) || byTitle(a, b));
    default: return arr.sort((a, b) => a.menu_order - b.menu_order || byTitle(a, b));
  }
}

/** Price state for display: sale active, regular, etc. */
export function priceInfo(p: Product | Variation | null) {
  if (!p) return { has: false, regular: null as number | null, sale: null as number | null, price: null as number | null, onSale: false };
  const now = Date.now();
  const sf = (p as Product).sale_from ? Date.parse((p as Product).sale_from as string) : null;
  const st = (p as Product).sale_to ? Date.parse((p as Product).sale_to as string) : null;
  const saleActive = p.sale_price !== null && p.sale_price !== undefined && (!sf || sf <= now) && (!st || st > now);
  const regular = p.regular_price !== null ? Number(p.regular_price) : null;
  const sale = saleActive ? Number(p.sale_price) : null;
  const price = sale ?? (p.price !== null ? Number(p.price) : regular);
  return { has: price !== null && price !== undefined, regular, sale, price, onSale: saleActive && regular !== null && sale !== null && sale < regular };
}

export function isPurchasable(p: Product | null) {
  if (!p) return false;
  if (p.product_type === "variable") return true; // decided per variation
  const pi = priceInfo(p);
  return pi.has && p.stock_status !== "outofstock";
}

export function qtyRulesFor(ix: SiteIndex, productId: number, variationId?: number | null) {
  const cats = new Set(termsOf(ix, productId, "product_cat").map((t) => t.id));
  return ix.qtyRules
    .filter((r) => r.scope === "all" || (r.scope === "product" && r.product_id === productId) || (r.scope === "variation" && variationId && r.variation_id === variationId) || (r.scope === "product_cat" && r.term_id && cats.has(r.term_id)))
    .sort((a, b) => a.min_qty - b.min_qty);
}

export function applyQtyDiscount(unit: number, qty: number, rules: QtyRule[]) {
  const r = [...rules].filter((x) => qty >= x.min_qty && (x.max_qty == null || qty <= x.max_qty)).sort((a, b) => a.priority - b.priority || b.min_qty - a.min_qty)[0];
  if (!r) return { unit, rule: null as QtyRule | null };
  let u = unit;
  if (r.discount_type === "percent") u = unit * (1 - Number(r.amount) / 100);
  else if (r.discount_type === "fixed_amount") u = Math.max(0, unit - Number(r.amount));
  else if (r.discount_type === "fixed_price") u = Number(r.amount);
  return { unit: Math.round(u * 100) / 100, rule: r };
}

export function setting<T = any>(ix: SiteIndex, key: string, fallback?: T): T {
  return (ix.settings[key] ?? fallback) as T;
}

export function adjacentProducts(ix: SiteIndex, post: Post) {
  // OceanWP product nav: previous/next by publish date within all products
  const list = published(ix, "product").sort((a, b) => (a.published_at || "").localeCompare(b.published_at || "") || a.id - b.id);
  const i = list.findIndex((p) => p.id === post.id);
  return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
}
