import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { getCartRow, viewCart } from "@/lib/cart";
import { getIndex, isPurchasable, priceInfo, productOf } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await viewCart());
}

/** Add to cart: { product_id, quantity, variation_id?, variation? } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const productId = Number(body.product_id);
  const qty = Math.max(1, Math.floor(Number(body.quantity) || 1));
  const ix = await getIndex();
  const post = ix.posts.find((p) => p.id === productId && p.post_type === "product" && p.status === "publish");
  const prod = productOf(ix, productId);
  if (!post || !prod) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  let variationId: number | null = null;
  let variationAttrs: Record<string, string> = {};
  if (prod.product_type === "variable") {
    const v = ix.variations.find((x) => x.id === Number(body.variation_id) && x.product_id === productId);
    if (!v) return NextResponse.json({ error: "Please choose product options&hellip;" }, { status: 400 });
    if (!priceInfo(v).has || v.stock_status === "outofstock") return NextResponse.json({ error: "Sorry, this product is unavailable." }, { status: 400 });
    variationId = v.id;
    variationAttrs = { ...(v.attributes || {}), ...(body.variation || {}) };
  } else if (!isPurchasable(prod)) {
    return NextResponse.json({ error: "Sorry, this product cannot be purchased." }, { status: 400 });
  }
  const unit = variationId ? ix.variations.find((x) => x.id === variationId)! : prod;
  if (unit.manage_stock && unit.stock_quantity != null && qty > unit.stock_quantity && prod.backorders === "no")
    return NextResponse.json({ error: `You cannot add that amount to the cart — we have ${unit.stock_quantity} in stock.` }, { status: 400 });

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
  return NextResponse.json({ ok: true, message: `“${post.title}” has been added to your cart.`, cart: await viewCart(cart) });
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
