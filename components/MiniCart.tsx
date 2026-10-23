"use client";
import Link from "next/link";
import { useCart, money } from "./useCart";

export default function MiniCart() {
  const cart = useCart();
  if (!cart || !cart.items.length) return <p className="woocommerce-mini-cart__empty-message">No products in the cart.</p>;
  return (
    <>
      <ul className="woocommerce-mini-cart cart_list product_list_widget">
        {cart.items.map((i) => (
          <li key={i.item_id} className="woocommerce-mini-cart-item mini_cart_item">
            <div className="owp-grid-wrap"><div className="owp-grid thumbnail">
              <Link href={i.link}>{i.image ? <img width={100} height={100} src={i.image} alt={i.name} /> : null}</Link>
            </div><div className="owp-grid content"><div><h3><Link href={i.link}>{i.name}</Link></h3>
              <span className="quantity">{i.quantity} &times; <span className="woocommerce-Price-amount amount">{money(i.unit)}</span></span>
            </div></div></div>
          </li>
        ))}
      </ul>
      <p className="woocommerce-mini-cart__total total"><strong>Subtotal:</strong> <span className="woocommerce-Price-amount amount">{money(cart.subtotal)}</span></p>
      <p className="woocommerce-mini-cart__buttons buttons">
        <Link href="/cart-2/" className="button wc-forward">View cart</Link>
        <Link href="/checkout-2/" className="button checkout wc-forward">Checkout</Link>
      </p>
    </>
  );
}
