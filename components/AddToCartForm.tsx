"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { publishCart, money } from "./useCart";

type Variation = { id: number; attributes: Record<string, string>; price: number | null; regular: number | null; sale: number | null; onSale: boolean; stock_status: string; stock_quantity: number | null; manage_stock: boolean; sku: string | null; image: string | null; description: string };
type Attr = { key: string; name: string; options: { value: string; label: string }[] };
type Rule = { min_qty: number; max_qty: number | null; discount_type: string; amount: number; name: string };

export default function AddToCartForm(props: {
  productId: number; title: string; type: string; purchasable: boolean; stockStatus: string; stockQty: number | null; manageStock: boolean;
  soldIndividually: boolean; minQty: number; maxQty: number | null; step: number; basePrice: number | null;
  attributes: Attr[]; variations: Variation[]; rules: Rule[];
}) {
  const [qty, setQty] = useState(props.minQty || 1);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const variable = props.type === "variable";

  const match = useMemo(() => {
    if (!variable) return null;
    if (props.attributes.some((a) => !sel[a.key])) return null;
    return props.variations.find((v) => props.attributes.every((a) => !v.attributes[a.key] || v.attributes[a.key] === sel[a.key])) || null;
  }, [sel, variable, props.attributes, props.variations]);

  const unitPrice = variable ? match?.price ?? null : props.basePrice;
  const activeRule = props.rules.filter((r) => qty >= r.min_qty && (r.max_qty == null || qty <= r.max_qty)).sort((a, b) => b.min_qty - a.min_qty)[0];
  const discounted = (p: number, r?: Rule) => !r ? p : r.discount_type === "percent" ? p * (1 - r.amount / 100) : r.discount_type === "fixed_amount" ? Math.max(0, p - r.amount) : r.amount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (variable && !match) { setMsg({ ok: false, text: "Please select some product options before adding this product to your cart." }); return; }
    setBusy(true);
    const r = await fetch("/api/cart/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ product_id: props.productId, quantity: qty, variation_id: match?.id, variation: sel }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: d.error }); return; }
    publishCart(d.cart);
    setMsg({ ok: true, text: d.message });
  };

  const stockText = (s: string, q: number | null, manage: boolean) => s === "outofstock" ? "Out of stock" : s === "onbackorder" ? "Available on backorder" : manage && q != null ? `${q} in stock` : "";
  const outOfStock = variable ? match?.stock_status === "outofstock" : props.stockStatus === "outofstock";

  if (!props.purchasable && !variable) {
    const st = stockText(props.stockStatus, props.stockQty, props.manageStock);
    return st ? <p className={`stock ${props.stockStatus === "outofstock" ? "out-of-stock" : "in-stock"}`}>{st}</p> : null;
  }

  return (
    <>
      {msg ? (
        <div className={msg.ok ? "woocommerce-message" : "woocommerce-error"} role="alert">
          {msg.ok ? <Link href="/cart-2/" className="button wc-forward">View cart</Link> : null} {msg.text}
        </div>
      ) : null}
      {props.rules.length ? (
        <table className="qty-discount-table">
          <thead><tr><th>數量</th><th>單價</th></tr></thead>
          <tbody>
            {props.rules.map((r, i) => (
              <tr key={i} className={activeRule === r ? "active" : ""}>
                <td>{r.max_qty ? `${r.min_qty} - ${r.max_qty}` : `${r.min_qty}+`}</td>
                <td>{unitPrice != null ? money(Math.round(discounted(unitPrice, r) * 100) / 100) : r.discount_type === "percent" ? `-${r.amount}%` : `-${money(r.amount)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {!variable && props.manageStock && props.stockQty != null ? <p className="stock in-stock">{stockText(props.stockStatus, props.stockQty, true)}</p> : null}
      <form className={variable ? "variations_form cart" : "cart"} onSubmit={submit} method="post">
        {variable ? (
          <table className="variations" role="presentation"><tbody>
            {props.attributes.map((a) => (
              <tr key={a.key}>
                <th className="label"><label htmlFor={a.key}>{a.name}</label></th>
                <td className="value">
                  <select id={a.key} name={`attribute_${a.key}`} value={sel[a.key] || ""} onChange={(e) => setSel({ ...sel, [a.key]: e.target.value })}>
                    <option value="">Choose an option</option>
                    {a.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {a === props.attributes[props.attributes.length - 1] && Object.keys(sel).length ? <a className="reset_variations" href="#" onClick={(e) => { e.preventDefault(); setSel({}); }}>Clear</a> : null}
                </td>
              </tr>
            ))}
          </tbody></table>
        ) : null}
        {variable && match ? (
          <div className="single_variation_wrap"><div className="woocommerce-variation single_variation">
            {match.description ? <div className="woocommerce-variation-description" dangerouslySetInnerHTML={{ __html: match.description }} /> : null}
            <div className="woocommerce-variation-price"><span className="price">{match.onSale ? <><del>{money(match.regular)}</del> <ins>{money(match.sale)}</ins></> : money(match.price)}</span></div>
            <div className="woocommerce-variation-availability">{stockText(match.stock_status, match.stock_quantity, match.manage_stock) ? <p className="stock">{stockText(match.stock_status, match.stock_quantity, match.manage_stock)}</p> : null}</div>
          </div></div>
        ) : null}
        <div className="woocommerce-variation-add-to-cart variations_button">
          {!props.soldIndividually ? (
            <div className="quantity">
              <label className="screen-reader-text" htmlFor="quantity">{props.title} quantity</label>
              <a href="#" className="minus" onClick={(e) => { e.preventDefault(); setQty(Math.max(props.minQty || 1, qty - (props.step || 1))); }}>-</a>
              <input type="number" id="quantity" className="input-text qty text" step={props.step || 1} min={props.minQty || 1} max={props.maxQty ?? undefined} name="quantity" value={qty} title="Qty" size={4} inputMode="numeric" onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
              <a href="#" className="plus" onClick={(e) => { e.preventDefault(); setQty(props.maxQty ? Math.min(props.maxQty, qty + (props.step || 1)) : qty + (props.step || 1)); }}>+</a>
            </div>
          ) : null}
          {variable ? <><input type="hidden" name="product_id" value={props.productId} /><input type="hidden" name="variation_id" className="variation_id" value={match?.id || ""} /></> : null}
          <button type="submit" name="add-to-cart" value={props.productId} className={`single_add_to_cart_button button alt${busy ? " loading" : ""}${variable && !match ? " disabled wc-variation-selection-needed" : ""}`} disabled={outOfStock}>Add to cart</button>
        </div>
      </form>
    </>
  );
}
