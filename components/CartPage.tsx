"use client";
import { useState } from "react";
import Link from "next/link";
import { publishCart, money, type CartView } from "./useCart";

export default function CartPage({ initial, checkoutHref }: { initial: CartView; checkoutHref: string }) {
  const [cart, setCart] = useState<CartView>(initial);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [coupon, setCoupon] = useState("");
  const [notices, setNotices] = useState<string[]>(initial.notices || []);
  const [busy, setBusy] = useState(false);
  const apply = async (method: string, body?: any, url = "/api/cart/") => {
    setBusy(true);
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = (await r.json()) as CartView;
    setBusy(false);
    setCart(d); setQty({}); setNotices(d.notices || []); publishCart(d);
  };
  if (!cart.items.length) {
    return (
      <div className="woocommerce">
        <div className="woocommerce-notices-wrapper">{notices.map((n) => <div key={n} className="woocommerce-message" role="alert">{n}</div>)}</div>
        <p className="cart-empty woocommerce-info">Your cart is currently empty.</p>{" "}
        <p className="return-to-shop"><Link className="button wc-backward" href="/shop-2/">Return to shop</Link></p>
      </div>
    );
  }
  return (
    <div className="woocommerce">
      <div className="woocommerce-notices-wrapper">{notices.map((n) => <div key={n} className="woocommerce-message" role="alert">{n}</div>)}</div>
      <form className={`woocommerce-cart-form${busy ? " processing" : ""}`} onSubmit={(e) => { e.preventDefault(); apply("PATCH", { items: Object.entries(qty).map(([item_id, quantity]) => ({ item_id: Number(item_id), quantity })) }); }}>
        <table className="shop_table shop_table_responsive cart woocommerce-cart-form__contents" cellSpacing={0}>
          <thead><tr><th className="product-remove"><span className="screen-reader-text">Remove item</span></th><th className="product-thumbnail"><span className="screen-reader-text">Thumbnail image</span></th><th className="product-name">Product</th><th className="product-price">Price</th><th className="product-quantity">Quantity</th><th className="product-subtotal">Subtotal</th></tr></thead>
          <tbody>
            {cart.items.map((i) => (
              <tr key={i.item_id} className="woocommerce-cart-form__cart-item cart_item">
                <td className="product-remove"><a href="#" className="remove" aria-label={`Remove ${i.name} from cart`} onClick={(e) => { e.preventDefault(); apply("DELETE", undefined, `/api/cart/?item=${i.item_id}`); }}>&times;</a></td>
                <td className="product-thumbnail"><Link href={i.link}>{i.image ? <img width={100} height={100} src={i.image} alt={i.name} className="attachment-woocommerce_thumbnail size-woocommerce_thumbnail" /> : null}</Link></td>
                <td className="product-name" data-title="Product">
                  <Link href={i.link}>{i.name}</Link>
                  {Object.keys(i.variation || {}).length ? <dl className="variation">{Object.entries(i.variation).map(([k, v]) => <span key={k}><dt>{k.replace(/^(attribute_)?pa_/, "")}:</dt> <dd><p>{v}</p></dd></span>)}</dl> : null}
                  {i.discount_rule ? <p className="pt-qty-rule"><small>{i.discount_rule}</small></p> : null}
                </td>
                <td className="product-price" data-title="Price">{i.unit < i.regular_unit ? <><del>{money(i.regular_unit)}</del> <ins>{money(i.unit)}</ins></> : money(i.unit)}</td>
                <td className="product-quantity" data-title="Quantity">
                  {i.max_qty === 1 ? <>1</> : (
                    <div className="quantity">
                      <label className="screen-reader-text" htmlFor={`qty-${i.item_id}`}>{i.name} quantity</label>
                      <input type="number" id={`qty-${i.item_id}`} className="input-text qty text" step={1} min={0} max={i.max_qty ?? undefined} value={qty[i.item_id] ?? i.quantity} title="Qty" size={4} inputMode="numeric" onChange={(e) => setQty({ ...qty, [i.item_id]: Number(e.target.value) })} />
                    </div>
                  )}
                </td>
                <td className="product-subtotal" data-title="Subtotal">{money(i.line_total)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={6} className="actions">
                <div className="coupon">
                  <label htmlFor="coupon_code" className="screen-reader-text">Coupon:</label>{" "}
                  <input type="text" name="coupon_code" className="input-text" id="coupon_code" value={coupon} placeholder="Coupon code" onChange={(e) => setCoupon(e.target.value)} />{" "}
                  <button type="button" className="button" name="apply_coupon" value="Apply coupon" onClick={() => coupon && apply("PATCH", { coupon })}>Apply coupon</button>
                </div>
                <button type="submit" className="button" name="update_cart" value="Update cart" disabled={!Object.keys(qty).length}>Update cart</button>
              </td>
            </tr>
          </tbody>
        </table>
      </form>
      <div className="cart-collaterals">
        <div className="cart_totals">
          <h2>Cart totals</h2>
          <table cellSpacing={0} className="shop_table shop_table_responsive"><tbody>
            <tr className="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">{money(cart.subtotal)}</td></tr>
            {cart.coupons.map((c) => (
              <tr key={c.code} className={`cart-discount coupon-${c.code}`}><th>Coupon: {c.code}</th><td data-title={`Coupon: ${c.code}`}>-{money(c.amount)} <a href="#" className="woocommerce-remove-coupon" onClick={(e) => { e.preventDefault(); apply("PATCH", { remove_coupon: c.code }); }}>[Remove]</a></td></tr>
            ))}
            <tr className="order-total"><th>Total</th><td data-title="Total"><strong>{money(cart.total)}</strong></td></tr>
          </tbody></table>
          <div className="wc-proceed-to-checkout"><Link href={checkoutHref} className="checkout-button button alt wc-forward">Proceed to checkout</Link></div>
        </div>
      </div>
    </div>
  );
}
