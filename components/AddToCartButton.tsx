"use client";
import { useState } from "react";
import Link from "next/link";
import { publishCart } from "./useCart";

export default function AddToCartButton({ productId, sku, title, href }: { productId: number; sku: string; title: string; href: string }) {
  const [state, setState] = useState<"idle" | "loading" | "added">("idle");
  const add = async (e: React.MouseEvent) => {
    e.preventDefault();
    setState("loading");
    const r = await fetch("/api/cart/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product_id: productId, quantity: 1 }) });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Error"); setState("idle"); return; }
    publishCart(d.cart);
    setState("added");
  };
  return (
    <>
      <a href={`?add-to-cart=${productId}`} data-quantity="1" className={`button product_type_simple add_to_cart_button ajax_add_to_cart${state === "loading" ? " loading" : ""}${state === "added" ? " added" : ""}`} data-product_id={productId} data-product_sku={sku} aria-label={`Add to cart: “${title}”`} rel="nofollow" onClick={add}>Add to cart</a>
      {state === "added" ? <Link href="/cart-2/" className="added_to_cart wc-forward" title="View cart">View cart</Link> : null}
    </>
  );
}
