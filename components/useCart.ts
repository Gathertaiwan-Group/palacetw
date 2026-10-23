"use client";
import { useEffect, useState } from "react";

export type CartLine = { item_id: number; product_id: number; variation_id: number | null; name: string; link: string; image: string | null; sku: string | null; variation: Record<string, string>; quantity: number; regular_unit: number; unit: number; line_total: number; discount_rule: string | null; max_qty: number | null };
export type CartView = { items: CartLine[]; count: number; subtotal: number; discount_total: number; total: number; coupons: { code: string; amount: number }[]; notices: string[] };

let cache: CartView | null = null;
let inflight: Promise<CartView> | null = null;
const EVT = "pt-cart";

export function publishCart(v: CartView) {
  cache = v;
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

export async function fetchCart(force = false) {
  if (cache && !force) return cache;
  if (!inflight) inflight = fetch("/api/cart/", { cache: "no-store" }).then((r) => r.json()).finally(() => { inflight = null; });
  const v = await inflight;
  publishCart(v);
  return v;
}

export function useCart() {
  const [cart, setCart] = useState<CartView | null>(cache);
  useEffect(() => {
    const fn = (e: Event) => setCart((e as CustomEvent).detail);
    window.addEventListener(EVT, fn);
    fetchCart().then(setCart).catch(() => {});
    return () => window.removeEventListener(EVT, fn);
  }, []);
  return cart;
}

export function money(v: number | null | undefined) {
  if (v === null || v === undefined) return "";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
