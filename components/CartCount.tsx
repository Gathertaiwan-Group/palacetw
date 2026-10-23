"use client";
import { useCart } from "./useCart";

export default function CartCount() {
  const cart = useCart();
  return <span className="wcmenucart-details count">{cart?.count ?? 0}</span>;
}
