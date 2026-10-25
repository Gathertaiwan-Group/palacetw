import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { getCartRow, viewCart } from "@/lib/cart";
import { currentUser, customerFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BILLING = ["first_name", "last_name", "company", "country", "address_1", "address_2", "city", "state", "postcode", "phone", "email"] as const;
const SHIPPING = ["first_name", "last_name", "company", "country", "address_1", "address_2", "city", "state", "postcode"] as const;
const REQUIRED_B: Record<string, string> = { first_name: "First name", last_name: "Last name", country: "Country / Region", address_1: "Street address", city: "Town / City", postcode: "Postcode / ZIP", phone: "Phone", email: "Email address" };

function pick(src: Record<string, any>, prefix: string, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(src[`${prefix}_${k}`] ?? "").trim().slice(0, 300)]));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const billing = pick(body, "billing", BILLING);
  const shipToDifferent = !!body.ship_to_different_address;
  const shipping = shipToDifferent ? pick(body, "shipping", SHIPPING) : { ...pick(body, "billing", SHIPPING) };
  const errors: string[] = [];
  for (const [k, label] of Object.entries(REQUIRED_B)) if (!billing[k]) errors.push(`<strong>Billing ${label}</strong> is a required field.`);
  if (billing.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email)) errors.push("<strong>Billing Email address</strong> is not a valid email address.");
  if (shipToDifferent) for (const k of ["first_name", "last_name", "country", "address_1", "city", "postcode"]) if (!shipping[k]) errors.push(`<strong>Shipping ${REQUIRED_B[k]}</strong> is a required field.`);
  if (!body.terms_ok) { /* old site had no terms checkbox */ }

  const cart = await getCartRow(false);
  const view = await viewCart(cart, billing.email);
  if (!view.items.length) errors.unshift("Your cart is currently empty.");
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const user = await currentUser();
  const customer = user ? await customerFor(user) : null;
  const sb = admin();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  // WooCommerce stamps new orders with the store currency (woocommerce_currency); read it from settings, not a literal.
  const { data: wooRow } = await sb.from("settings").select("value").eq("key", "woocommerce").maybeSingle();
  const currency = String((wooRow?.value as { currency?: string } | null)?.currency || "").trim().toUpperCase() || "TWD";
  const { data: order, error } = await sb.from("orders").insert({
    status: "pending",
    currency,
    customer_id: customer?.id ?? null,
    billing, shipping,
    payment_method: "pending",
    payment_method_title: "待付款（尚未串接金流）",
    customer_ip: ip,
    customer_user_agent: (req.headers.get("user-agent") || "").slice(0, 500),
    customer_note: String(body.order_comments || "").slice(0, 2000),
    created_via: "checkout",
    discount_total: view.discount_total,
    total: view.total,
    coupon_codes: view.coupons.map((c) => c.code),
  }).select("id, order_key").single();
  if (error || !order) return NextResponse.json({ errors: ["Unable to create order: " + (error?.message || "unknown")] }, { status: 500 });
  await sb.from("orders").update({ order_number: String(order.id) }).eq("id", order.id);

  const lines = view.items.map((i) => ({
    order_id: order.id, item_type: "line_item", name: i.name, product_id: i.product_id, variation_id: i.variation_id, sku: i.sku,
    quantity: i.quantity, unit_price: i.unit, subtotal: i.line_total, total: i.line_total,
    meta: { variation: i.variation, discount_rule: i.discount_rule, regular_unit: i.regular_unit },
  }));
  for (const c of view.coupons) lines.push({ order_id: order.id, item_type: "coupon", name: c.code, product_id: null as any, variation_id: null, sku: null, quantity: 1, unit_price: null as any, subtotal: 0, total: -c.amount, meta: {} as any });
  const { error: liErr } = await sb.from("order_items").insert(lines);
  if (liErr) return NextResponse.json({ errors: ["Unable to save order items: " + liErr.message] }, { status: 500 });
  await sb.from("order_notes").insert({ order_id: order.id, content: "訂單已建立，狀態：待付款（未串接任何金流）。", added_by: "system" });
  if (cart) {
    await sb.from("cart_items").delete().eq("cart_id", cart.id);
    await sb.from("carts").update({ coupon_codes: [] }).eq("id", cart.id);
  }
  return NextResponse.json({ ok: true, order_id: order.id, key: order.order_key, redirect: `/checkout/order-received/${order.id}/?key=${order.order_key}` });
}
