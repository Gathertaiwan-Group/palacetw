import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { addToCart, getCartRow, viewCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await viewCart());
}

/** Add to cart: { product_id, quantity, variation_id?, variation? } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const r = await addToCart({ productId: Number(body.product_id), quantity: body.quantity, variationId: body.variation_id, variation: body.variation });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, message: r.message, cart: r.cart });
}

/** Update quantities: { items: [{ item_id, quantity }] } or apply/remove coupon: { coupon, remove_coupon } */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const cart = await getCartRow(false);
  if (!cart) return NextResponse.json(await viewCart(null));
  const sb = admin();
  for (const it of body.items || []) {
    const q = Math.floor(Number(it.quantity));
    if (q <= 0) await sb.from("cart_items").delete().eq("id", it.item_id).eq("cart_id", cart.id);
    else await sb.from("cart_items").update({ quantity: q }).eq("id", it.item_id).eq("cart_id", cart.id);
  }
  let notice: string | null = null;
  if (body.coupon) {
    const code = String(body.coupon).trim().toLowerCase();
    const { data: c } = await sb.from("coupons").select("code").ilike("code", code).eq("status", "publish").maybeSingle();
    if (!c) notice = `Coupon "${code}" does not exist!`;
    else if (!(cart.coupon_codes || []).includes(code)) {
      cart.coupon_codes = [...(cart.coupon_codes || []), code];
      await sb.from("carts").update({ coupon_codes: cart.coupon_codes }).eq("id", cart.id);
      notice = "Coupon code applied successfully.";
    }
  }
  if (body.remove_coupon) {
    cart.coupon_codes = (cart.coupon_codes || []).filter((c: string) => c !== String(body.remove_coupon).toLowerCase());
    await sb.from("carts").update({ coupon_codes: cart.coupon_codes }).eq("id", cart.id);
    notice = "Coupon has been removed.";
  }
  const view = await viewCart(cart);
  if (notice) view.notices.unshift(notice);
  return NextResponse.json(view);
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("item"));
  const cart = await getCartRow(false);
  if (cart && id) await admin().from("cart_items").delete().eq("id", id).eq("cart_id", cart.id);
  return NextResponse.json(await viewCart(cart));
}
