import "server-only";
import { AdminError, type Actor, audit, must, refreshSite, sb, num, int } from "./core";
import { createPost, getPost, updatePost, type PostInput } from "./posts";

export type ProductFields = {
  product_type?: "simple" | "variable" | "grouped" | "external";
  sku?: string | null;
  regular_price?: number | null;
  sale_price?: number | null;
  sale_from?: string | null;
  sale_to?: string | null;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  backorders?: "no" | "notify" | "yes";
  low_stock_amount?: number | null;
  sold_individually?: boolean;
  featured?: boolean;
  catalog_visibility?: "visible" | "catalog" | "search" | "hidden";
  purchasable?: boolean;
  short_description?: string;
  gallery_image_ids?: number[];
  upsell_ids?: number[];
  cross_sell_ids?: number[];
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  external_url?: string | null;
  button_text?: string | null;
  purchase_note?: string;
  min_qty?: number;
  max_qty?: number | null;
  qty_step?: number;
};

const PRODUCT_KEYS: (keyof ProductFields)[] = [
  "product_type", "sku", "regular_price", "sale_price", "sale_from", "sale_to", "manage_stock", "stock_quantity", "stock_status", "backorders",
  "low_stock_amount", "sold_individually", "featured", "catalog_visibility", "purchasable", "short_description", "gallery_image_ids", "upsell_ids",
  "cross_sell_ids", "weight", "length", "width", "height", "external_url", "button_text", "purchase_note", "min_qty", "max_qty", "qty_step",
];

/** WooCommerce _price: sale price when the sale is active, otherwise the regular price. */
export function activePrice(p: { regular_price: unknown; sale_price: unknown; sale_from?: unknown; sale_to?: unknown }) {
  const now = Date.now();
  const reg = num(p.regular_price);
  const sale = num(p.sale_price);
  const from = p.sale_from ? Date.parse(String(p.sale_from)) : null;
  const to = p.sale_to ? Date.parse(String(p.sale_to)) : null;
  const active = sale !== null && (!from || from <= now) && (!to || to > now);
  return active ? sale : reg;
}

function stockStatusFor(row: { manage_stock?: boolean; stock_quantity?: number | null; backorders?: string; stock_status?: string }) {
  if (!row.manage_stock) return row.stock_status;
  const q = row.stock_quantity ?? 0;
  if (q > 0) return "instock";
  return row.backorders && row.backorders !== "no" ? "onbackorder" : "outofstock";
}

export async function getProduct(id: number) {
  const post = await getPost(id);
  if (post.post_type !== "product") throw new AdminError(`ID ${id} 不是商品`);
  const product = must(await sb().from("products").select("*").eq("post_id", id).maybeSingle());
  const variations = must(await sb().from("product_variations").select("*").eq("product_id", id).order("menu_order").order("id"));
  const attributes = must(await sb().from("product_attribute_values").select("*").eq("product_id", id).order("position"));
  return { ...post, product, variations: variations || [], attributes: attributes || [] };
}

export async function listProducts(opts: { search?: string; status?: string; category_id?: number; stock_status?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("posts").select("id,title,slug,path,status,published_at,featured_media_id,products!inner(sku,product_type,regular_price,sale_price,price,stock_status,stock_quantity,manage_stock,featured)", { count: "exact" }).eq("post_type", "product");
  if (opts.status && opts.status !== "any") q = q.eq("status", opts.status);
  else q = q.neq("status", "trash");
  if (opts.stock_status) q = q.eq("products.stock_status", opts.stock_status);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.ilike("title", `%${s}%`);
  }
  if (opts.category_id) {
    const rels = must(await sb().from("term_relationships").select("object_id").eq("term_id", opts.category_id)) as any[];
    q = q.in("id", rels.map((r) => r.object_id).concat([-1]));
  }
  const res = await q.order("menu_order").order("title").range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

function pickProductFields(f: ProductFields) {
  const patch: Record<string, unknown> = {};
  for (const k of PRODUCT_KEYS) if (f[k] !== undefined) patch[k] = f[k];
  for (const k of ["regular_price", "sale_price", "weight", "length", "width", "height"]) if (k in patch) patch[k] = num(patch[k]);
  for (const k of ["stock_quantity", "low_stock_amount", "max_qty"]) if (k in patch) patch[k] = int(patch[k]);
  for (const k of ["min_qty", "qty_step"]) if (k in patch) patch[k] = Math.max(1, int(patch[k]) ?? 1);
  if ("sku" in patch && patch.sku === "") patch.sku = null;
  return patch;
}

export async function saveProduct(actor: Actor, id: number | null, post: PostInput, fields: ProductFields) {
  let pid = id;
  if (!pid) pid = (await createPost(actor, "product", post)).id as number;
  else if (Object.keys(post).length) await updatePost(actor, pid, post);
  const before = must(await sb().from("products").select("*").eq("post_id", pid).maybeSingle()) as any;
  const patch = pickProductFields(fields);
  if (Object.keys(patch).length) {
    const merged = { ...(before || {}), ...patch };
    if (merged.sale_price !== null && merged.regular_price !== null && Number(merged.sale_price) >= Number(merged.regular_price)) throw new AdminError("特價必須低於原價");
    patch.price = activePrice(merged);
    patch.stock_status = stockStatusFor(merged) ?? "instock";
    if (before) must(await sb().from("products").update(patch).eq("post_id", pid));
    else must(await sb().from("products").insert({ post_id: pid, ...patch }));
    await audit(actor, "product.update_data", "product", pid, before, { ...(before || {}), ...patch });
    refreshSite();
  }
  return getProduct(pid);
}

/** Quick price / stock change for a product or a variation (MCP + list quick-edit). */
export async function setPriceStock(actor: Actor, target: { product_id?: number; variation_id?: number }, f: { regular_price?: number | null; sale_price?: number | null; stock_quantity?: number | null; stock_status?: string; manage_stock?: boolean; adjust_stock_by?: number }) {
  const table = target.variation_id ? "product_variations" : "products";
  const key = target.variation_id ? "id" : "post_id";
  const id = target.variation_id ?? target.product_id;
  if (!id) throw new AdminError("需要 product_id 或 variation_id");
  const before = must(await sb().from(table).select("*").eq(key, id).maybeSingle()) as any;
  if (!before) throw new AdminError(`找不到 ${table} ${id}`, 404);
  const patch: Record<string, unknown> = {};
  if (f.regular_price !== undefined) patch.regular_price = num(f.regular_price);
  if (f.sale_price !== undefined) patch.sale_price = num(f.sale_price);
  if (f.manage_stock !== undefined) patch.manage_stock = f.manage_stock;
  if (f.stock_quantity !== undefined) patch.stock_quantity = int(f.stock_quantity);
  if (f.adjust_stock_by) {
    patch.manage_stock = true;
    patch.stock_quantity = (int(patch.stock_quantity ?? before.stock_quantity) ?? 0) + Math.trunc(f.adjust_stock_by);
  }
  if (f.stock_status !== undefined) {
    if (!["instock", "outofstock", "onbackorder"].includes(f.stock_status)) throw new AdminError("stock_status 只能是 instock / outofstock / onbackorder");
    patch.stock_status = f.stock_status;
  }
  const merged = { ...before, ...patch };
  if (merged.sale_price !== null && merged.regular_price !== null && Number(merged.sale_price) >= Number(merged.regular_price)) throw new AdminError("特價必須低於原價");
  patch.price = activePrice(merged);
  patch.stock_status = stockStatusFor(merged) ?? "instock";
  must(await sb().from(table).update(patch).eq(key, id));
  // variable parent: keep the parent's _price at the lowest variation price (WooCommerce sync)
  if (target.variation_id) await syncVariablePrice(before.product_id);
  await audit(actor, target.variation_id ? "variation.price_stock" : "product.price_stock", target.variation_id ? "variation" : "product", id, pick(before), pick({ ...before, ...patch }));
  refreshSite();
  return { ...before, ...patch };
}

function pick(r: any) {
  return { regular_price: r.regular_price, sale_price: r.sale_price, price: r.price, manage_stock: r.manage_stock, stock_quantity: r.stock_quantity, stock_status: r.stock_status };
}

async function syncVariablePrice(productId: number) {
  const vars = (must(await sb().from("product_variations").select("price,stock_status,status").eq("product_id", productId)) as any[]).filter((v) => v.status === "publish");
  const prices = vars.map((v) => num(v.price)).filter((p): p is number => p !== null);
  const anyIn = vars.some((v) => v.stock_status !== "outofstock");
  await sb().from("products").update({ price: prices.length ? Math.min(...prices) : null, stock_status: vars.length ? (anyIn ? "instock" : "outofstock") : "instock" }).eq("post_id", productId).eq("product_type", "variable");
}

export type VariationInput = {
  attributes?: Record<string, string>;
  sku?: string | null;
  regular_price?: number | null;
  sale_price?: number | null;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: string;
  description?: string;
  status?: "publish" | "private" | "draft";
  image_id?: number | null;
  menu_order?: number;
};

export async function saveVariation(actor: Actor, productId: number, variationId: number | null, v: VariationInput) {
  const patch: Record<string, unknown> = {};
  for (const k of ["attributes", "sku", "description", "status", "image_id", "manage_stock", "stock_status"] as const) if (v[k] !== undefined) patch[k] = v[k];
  if (v.regular_price !== undefined) patch.regular_price = num(v.regular_price);
  if (v.sale_price !== undefined) patch.sale_price = num(v.sale_price);
  if (v.stock_quantity !== undefined) patch.stock_quantity = int(v.stock_quantity);
  if (v.menu_order !== undefined) patch.menu_order = int(v.menu_order) ?? 0;
  if (patch.sku === "") patch.sku = null;
  let before: any = null;
  if (variationId) {
    before = must(await sb().from("product_variations").select("*").eq("id", variationId).eq("product_id", productId).maybeSingle());
    if (!before) throw new AdminError(`找不到變體 ${variationId}`, 404);
  }
  const merged = { ...(before || {}), ...patch };
  patch.price = activePrice(merged);
  patch.stock_status = stockStatusFor(merged) ?? "instock";
  let row: any;
  if (variationId) row = must(await sb().from("product_variations").update(patch).eq("id", variationId).select("*").single());
  else row = must(await sb().from("product_variations").insert({ product_id: productId, ...patch }).select("*").single());
  await syncVariablePrice(productId);
  await audit(actor, variationId ? "variation.update" : "variation.create", "variation", row.id, before, row);
  refreshSite();
  return row;
}

export async function deleteVariation(actor: Actor, variationId: number) {
  const before = must(await sb().from("product_variations").select("*").eq("id", variationId).maybeSingle()) as any;
  if (!before) throw new AdminError(`找不到變體 ${variationId}`, 404);
  must(await sb().from("product_variations").delete().eq("id", variationId));
  await syncVariablePrice(before.product_id);
  await audit(actor, "variation.delete", "variation", variationId, before, null);
  refreshSite();
  return { id: variationId, deleted: true };
}

/** Per-product attributes (used for variations): replaces the whole set. */
export async function saveAttributes(actor: Actor, productId: number, attrs: { name: string; options: string[]; visible?: boolean; used_for_variations?: boolean }[]) {
  const before = must(await sb().from("product_attribute_values").select("*").eq("product_id", productId));
  must(await sb().from("product_attribute_values").delete().eq("product_id", productId));
  const rows = attrs.filter((a) => a.name.trim()).map((a, i) => ({ product_id: productId, attribute_id: null, name: a.name.trim(), options: a.options.map((o) => o.trim()).filter(Boolean), position: i, visible: a.visible ?? true, used_for_variations: a.used_for_variations ?? true }));
  if (rows.length) must(await sb().from("product_attribute_values").insert(rows));
  await audit(actor, "product.attributes", "product", productId, before, rows);
  refreshSite();
  return rows;
}
