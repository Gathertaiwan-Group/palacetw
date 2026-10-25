import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { addToCart, CART_COOKIE, NOTICE_COOKIE } from "@/lib/cart";

export const dynamic = "force-dynamic";

/**
 * No-JS add-to-cart (WooCommerce's non-AJAX path). proxy.ts rewrites here:
 *  - POST <product page> with form field add-to-cart=ID (&quantity, &variation_id, &attribute_*)
 *  - GET  <any page>?add-to-cart=ID[&quantity=N]
 * It writes cart_items, sets the cart cookie and a one-shot notice cookie, then 303s back to the page.
 */
async function handle(req: Request, fields: URLSearchParams | FormData) {
  const url = new URL(req.url);
  const get = (k: string) => { const v = fields.get(k); return typeof v === "string" ? v : null; };
  const productId = Number(get("add-to-cart") || get("product_id"));
  const variation: Record<string, string> = {};
  fields.forEach((v, k) => { if (k.startsWith("attribute_") && typeof v === "string" && v) variation[k.slice("attribute_".length)] = v; });

  const r = await addToCart({ productId, quantity: get("quantity"), variationId: get("variation_id"), variation });

  // back to where the form/link was (never off-site); "/" → the product page itself
  let back = url.searchParams.get("return") || "";
  if (!back.startsWith("/") || back.startsWith("//")) back = "";
  if (!back || back === "/") back = r.link || "/";
  const res = NextResponse.redirect(new URL(back, req.url), 303);
  const notice = r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error };
  res.cookies.set(NOTICE_COOKIE, encodeURIComponent(JSON.stringify(notice)), { path: "/", maxAge: 60, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  const key = (await cookies()).get(CART_COOKIE)?.value;
  if (key) res.cookies.set(CART_COOKIE, key, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 48, secure: process.env.NODE_ENV === "production" });
  res.headers.set("cache-control", "private, no-store");
  return res;
}

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  const fields = ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")
    ? await req.formData().catch(() => new FormData())
    : new URLSearchParams(await req.text().catch(() => ""));
  // a ?add-to-cart= query on the POST URL also counts
  const q = new URL(req.url).searchParams;
  if (!fields.get("add-to-cart") && q.get("add-to-cart")) fields.set("add-to-cart", q.get("add-to-cart")!);
  return handle(req, fields);
}

export async function GET(req: Request) {
  return handle(req, new URL(req.url).searchParams);
}
