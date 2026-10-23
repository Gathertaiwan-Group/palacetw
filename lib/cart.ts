import "server-only";
import { cookies } from "next/headers";
import { admin } from "./supabase";
import {
  getIndex, priceInfo, productOf, qtyRulesFor, applyQtyDiscount, mediaById, link, type SiteIndex,
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
    image: img?.public_url || null, sku: variation?.sku || prod.sku, variation: row.variation || {}, quantity: row.quantity,
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
