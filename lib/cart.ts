import "server-only";
import { cookies } from "next/headers";
import { admin } from "./supabase";
import { variantUrl } from "./img";
import {
  getIndex, priceInfo, productOf, isPurchasable, qtyRulesFor, applyQtyDiscount, mediaById, link, type SiteIndex,
} from "./data";

export const CART_COOKIE = "pt_cart";

export type CartLine = {
  item_id: number; product_id: number; variation_id: number | null; name: string; link: string; image: string | null;
  sku: string | null; variation: Record<string, string>; quantity: number; regular_unit: number; unit: number; line_total: number;
  discount_rule: string | null; max_qty: number | null;
};
export type CartView = {
  items: CartLine[]; count: number; subtotal: number; discount_total: number; total: number; coupons: { code: string; amount: number }[];
  notices: string[];
};

export async function getSessionKey(create = false) {
  const jar = await cookies();
  let key = jar.get(CART_COOKIE)?.value || null;
  if (!key && create) {
    key = crypto.randomUUID();
    jar.set(CART_COOKIE, key, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 48, secure: process.env.NODE_ENV === "production" });
  }
  return key;
}

export async function getCartRow(create = false) {
  const key = await getSessionKey(create);
  if (!key) return null;
  const sb = admin();
  const { data } = await sb.from("carts").select("*").eq("session_key", key).maybeSingle();
  if (data) return data;
  if (!create) return null;
  const { data: ins, error } = await sb.from("carts").insert({ session_key: key }).select("*").single();
  if (error) throw new Error(error.message);
  return ins;
}

function lineFor(ix: SiteIndex, row: any): CartLine | null {
  const post = ix.posts.find((p) => p.id === row.product_id && p.status === "publish");
  const prod = productOf(ix, row.product_id);
  if (!post || !prod) return null;
  const variation = row.variation_id ? ix.variations.find((v) => v.id === row.variation_id) || null : null;
  const pi = priceInfo(variation || prod);
  if (!pi.has) return null;
  const base = Number(pi.price);
  const rules = qtyRulesFor(ix, row.product_id, row.variation_id);
  const { unit, rule } = applyQtyDiscount(base, row.quantity, rules);
  const img = mediaById(ix, variation?.image_id || post.featured_media_id);
  const stockMax = (variation || prod).manage_stock ? (variation || prod).stock_quantity : null;
  return {
    item_id: row.id, product_id: row.product_id, variation_id: row.variation_id, name: post.title, link: link(post),
    image: variantUrl(img, 200), sku: variation?.sku || prod.sku, variation: row.variation || {}, quantity: row.quantity,
    regular_unit: base, unit, line_total: Math.round(unit * row.quantity * 100) / 100, discount_rule: rule?.name || null,
    max_qty: prod.sold_individually ? 1 : stockMax ?? prod.max_qty,
  };
}

async function couponDiscount(codes: string[], items: CartLine[], subtotal: number, email?: string) {
  if (!codes.length) return { list: [] as { code: string; amount: number }[], notices: [] as string[] };
  const sb = admin();
  const out: { code: string; amount: number }[] = [];
  const notices: string[] = [];
  for (const code of codes) {
    const { data: c } = await sb.from("coupons").select("*").ilike("code", code).eq("status", "publish").maybeSingle();
    const err = validateCoupon(c, subtotal, email);
    if (err) { notices.push(err); continue; }
    let amount = 0;
    const eligible = items.filter((i) => (!c.product_ids?.length || c.product_ids.includes(i.product_id)) && !(c.excluded_product_ids || []).includes(i.product_id));
    const eligibleSub = eligible.reduce((s, i) => s + i.line_total, 0);
    if (c.discount_type === "percent") amount = (eligibleSub * Number(c.amount)) / 100;
    else if (c.discount_type === "fixed_product") amount = eligible.reduce((s, i) => s + Math.min(i.line_total, Number(c.amount) * i.quantity), 0);
    else amount = Math.min(Number(c.amount), subtotal);
    out.push({ code: c.code, amount: Math.round(amount * 100) / 100 });
  }
  return { list: out, notices };
}

export function validateCoupon(c: any, subtotal: number, email?: string): string | null {
  if (!c) return "Coupon does not exist!";
  if (c.date_expires && Date.parse(c.date_expires) < Date.now()) return `Coupon "${c.code}" has expired.`;
  if (c.usage_limit != null && c.usage_count >= c.usage_limit) return `Coupon usage limit has been reached.`;
  if (c.minimum_amount != null && subtotal < Number(c.minimum_amount)) return `The minimum spend for this coupon is ${c.minimum_amount}.`;
  if (c.maximum_amount != null && Number(c.maximum_amount) > 0 && subtotal > Number(c.maximum_amount)) return `The maximum spend for this coupon is ${c.maximum_amount}.`;
  if (email && c.email_restrictions?.length && !c.email_restrictions.map((x: string) => x.toLowerCase()).includes(email.toLowerCase())) return "Sorry, this coupon is not valid for your email.";
  return null;
}

export async function viewCart(cartRow?: any, email?: string): Promise<CartView> {
  const cart = cartRow === undefined ? await getCartRow(false) : cartRow;
  const empty: CartView = { items: [], count: 0, subtotal: 0, discount_total: 0, total: 0, coupons: [], notices: [] };
  if (!cart) return empty;
  const [{ data: rows }, ix] = await Promise.all([
    admin().from("cart_items").select("*").eq("cart_id", cart.id).order("id"),
    getIndex(),
  ]);
  const items = (rows || []).map((r) => lineFor(ix, r)).filter(Boolean) as CartLine[];
  const subtotal = Math.round(items.reduce((s, i) => s + i.line_total, 0) * 100) / 100;
  const { list, notices } = await couponDiscount(cart.coupon_codes || [], items, subtotal, email);
  const discount_total = Math.min(subtotal, list.reduce((s, c) => s + c.amount, 0));
  return {
    items, count: items.reduce((s, i) => s + i.quantity, 0), subtotal, discount_total,
    total: Math.round((subtotal - discount_total) * 100) / 100, coupons: list, notices,
  };
}

export type AddResult =
  | { ok: true; message: string; cart: CartView; link: string }
  | { ok: false; error: string; status: number; link: string | null };

/**
 * Shared add-to-cart used by the AJAX endpoint (/api/cart) and the no-JS form / ?add-to-cart= fallback (/api/cart/form).
 * For variable products without variation_id, the variation is resolved from attribute_* values (as WooCommerce does).
 */
export async function addToCart(input: { productId: number; quantity?: unknown; variationId?: unknown; variation?: Record<string, string> | null }): Promise<AddResult> {
  const productId = Number(input.productId);
  const qty = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const ix = await getIndex();
  const post = ix.posts.find((p) => p.id === productId && p.post_type === "product" && p.status === "publish");
  const prod = productOf(ix, productId);
  if (!post || !prod) return { ok: false, error: "Product not found.", status: 404, link: null };
  const href = link(post);

  let variationId: number | null = null;
  let variationAttrs: Record<string, string> = {};
  if (prod.product_type === "variable") {
    const sel = input.variation || {};
    let v = ix.variations.find((x) => x.id === Number(input.variationId) && x.product_id === productId);
    if (!v && Object.keys(sel).length) {
      v = ix.variations.find((x) => x.product_id === productId && Object.entries(x.attributes || {}).every(([k, val]) => !val || sel[k] === val)
        && Object.keys(x.attributes || {}).every((k) => !!sel[k]));
    }
    if (!v) return { ok: false, error: "Please choose product options&hellip;", status: 400, link: href };
    if (!priceInfo(v).has || v.stock_status === "outofstock") return { ok: false, error: "Sorry, this product is unavailable.", status: 400, link: href };
    variationId = v.id;
    variationAttrs = { ...(v.attributes || {}), ...sel };
  } else if (!isPurchasable(prod)) {
    return { ok: false, error: "Sorry, this product cannot be purchased.", status: 400, link: href };
  }
  const unit = variationId ? ix.variations.find((x) => x.id === variationId)! : prod;
  if (unit.manage_stock && unit.stock_quantity != null && qty > unit.stock_quantity && prod.backorders === "no")
    return { ok: false, error: `You cannot add that amount to the cart — we have ${unit.stock_quantity} in stock.`, status: 400, link: href };

  const cart = await getCartRow(true);
  const sb = admin();
  const { data: existing } = await sb.from("cart_items").select("*").eq("cart_id", cart.id).eq("product_id", productId)
    .filter("variation_id", variationId ? "eq" : "is", variationId ?? null).maybeSingle();
  if (existing) {
    const newQty = prod.sold_individually ? 1 : existing.quantity + qty;
    await sb.from("cart_items").update({ quantity: newQty }).eq("id", existing.id);
  } else {
    await sb.from("cart_items").insert({ cart_id: cart.id, product_id: productId, variation_id: variationId, quantity: prod.sold_individually ? 1 : qty, variation: variationAttrs });
  }
  await sb.from("carts").update({ expires_at: new Date(Date.now() + 48 * 3600e3).toISOString() }).eq("id", cart.id);
  return { ok: true, message: `“${post.title}” has been added to your cart.`, cart: await viewCart(cart), link: href };
}

/** One-shot notice shown after a no-JS add-to-cart redirect (read and cleared client-side by components/FlashNotice). */
export const NOTICE_COOKIE = "pt_notice";
