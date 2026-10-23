"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money, publishCart, type CartView } from "./useCart";

const COUNTRIES: [string, string][] = [["TW", "Taiwan"], ["HK", "Hong Kong"], ["MO", "Macao"], ["CN", "China"], ["JP", "Japan"], ["SG", "Singapore"], ["MY", "Malaysia"], ["US", "United States (US)"]];

type F = { key: string; label: string; cls: string; required?: boolean; type?: string; placeholder?: string; auto?: string };
const BILLING: F[] = [
  { key: "first_name", label: "First name", cls: "form-row-first", required: true, auto: "given-name" },
  { key: "last_name", label: "Last name", cls: "form-row-last", required: true, auto: "family-name" },
  { key: "company", label: "Company name", cls: "form-row-wide", auto: "organization" },
  { key: "country", label: "Country / Region", cls: "form-row-wide address-field update_totals_on_change", required: true, type: "country" },
  { key: "address_1", label: "Street address", cls: "form-row-wide address-field", required: true, placeholder: "House number and street name", auto: "address-line1" },
  { key: "address_2", label: "Apartment, suite, unit, etc.", cls: "form-row-wide address-field", placeholder: "Apartment, suite, unit, etc. (optional)", auto: "address-line2" },
  { key: "city", label: "Town / City", cls: "form-row-wide address-field", required: true, auto: "address-level2" },
  { key: "state", label: "State / County", cls: "form-row-wide address-field", auto: "address-level1" },
  { key: "postcode", label: "Postcode / ZIP", cls: "form-row-wide address-field", required: true, auto: "postal-code" },
  { key: "phone", label: "Phone", cls: "form-row-wide", required: true, type: "tel", auto: "tel" },
  { key: "email", label: "Email address", cls: "form-row-wide", required: true, type: "email", auto: "email" },
];
const SHIPPING = BILLING.filter((f) => !["phone", "email"].includes(f.key));

function Field({ prefix, f, value, onChange }: { prefix: string; f: F; value: string; onChange: (v: string) => void }) {
  const id = `${prefix}_${f.key}`;
  return (
    <p className={`form-row ${f.cls}${f.required ? " validate-required" : ""}${f.type === "email" ? " validate-email" : ""}${f.type === "tel" ? " validate-phone" : ""}`} id={`${id}_field`}>
      <label htmlFor={id}>{f.label}&nbsp;{f.required ? <abbr className="required" title="required">*</abbr> : <span className="optional">(optional)</span>}</label>
      <span className="woocommerce-input-wrapper">
        {f.type === "country" ? (
          <select name={id} id={id} className="country_to_state country_select" autoComplete="country" value={value || "TW"} onChange={(e) => onChange(e.target.value)}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        ) : (
          <input type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"} className="input-text" name={id} id={id} placeholder={f.placeholder || ""} value={value} autoComplete={f.auto} onChange={(e) => onChange(e.target.value)} />
        )}
      </span>
    </p>
  );
}

export default function CheckoutForm({ cart, loggedIn, defaults }: { cart: CartView; loggedIn: boolean; defaults: Record<string, string> }) {
  const router = useRouter();
  const [v, setV] = useState<Record<string, string>>({ billing_country: "TW", shipping_country: "TW", ...defaults });
  const [ship, setShip] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (x: string) => setV((o) => ({ ...o, [k]: x }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErrors([]);
    const r = await fetch("/api/checkout/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...v, ship_to_different_address: ship, payment_method: "pending" }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setErrors(d.errors || ["Error"]); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    publishCart({ items: [], count: 0, subtotal: 0, discount_total: 0, total: 0, coupons: [], notices: [] });
    router.push(d.redirect);
  };
  return (
    <div className="woocommerce">
      <div className="woocommerce-notices-wrapper">
        {errors.length ? <ul className="woocommerce-error" role="alert">{errors.map((x) => <li key={x} dangerouslySetInnerHTML={{ __html: x }} />)}</ul> : null}
      </div>
      {!loggedIn ? <div className="woocommerce-form-login-toggle"><div className="woocommerce-info">Returning customer? <Link href="/my-account-2/" className="showlogin">Click here to login</Link></div></div> : null}
      <form name="checkout" method="post" className={`checkout woocommerce-checkout${busy ? " processing" : ""}`} onSubmit={submit} noValidate>
        <div className="col2-set" id="customer_details">
          <div className="col-1">
            <div className="woocommerce-billing-fields">
              <h3>Billing details</h3>
              <div className="woocommerce-billing-fields__field-wrapper">
                {BILLING.map((f) => <Field key={f.key} prefix="billing" f={f} value={v[`billing_${f.key}`] || ""} onChange={set(`billing_${f.key}`)} />)}
              </div>
            </div>
          </div>
          <div className="col-2">
            <div className="woocommerce-shipping-fields">
              <h3 id="ship-to-different-address">
                <label className="woocommerce-form__label woocommerce-form__label-for-checkbox checkbox">
                  <input id="ship-to-different-address-checkbox" className="woocommerce-form__input woocommerce-form__input-checkbox input-checkbox" type="checkbox" name="ship_to_different_address" value="1" checked={ship} onChange={(e) => setShip(e.target.checked)} /> <span>Ship to a different address?</span>
                </label>
              </h3>
              {ship ? (
                <div className="shipping_address"><div className="woocommerce-shipping-fields__field-wrapper">
                  {SHIPPING.map((f) => <Field key={f.key} prefix="shipping" f={f} value={v[`shipping_${f.key}`] || ""} onChange={set(`shipping_${f.key}`)} />)}
                </div></div>
              ) : null}
            </div>
            <div className="woocommerce-additional-fields">
              <h3>Additional information</h3>
              <div className="woocommerce-additional-fields__field-wrapper">
                <p className="form-row notes" id="order_comments_field">
                  <label htmlFor="order_comments">Order notes&nbsp;<span className="optional">(optional)</span></label>
                  <span className="woocommerce-input-wrapper"><textarea name="order_comments" className="input-text" id="order_comments" placeholder="Notes about your order, e.g. special notes for delivery." rows={2} cols={5} value={v.order_comments || ""} onChange={(e) => set("order_comments")(e.target.value)} /></span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <h3 id="order_review_heading">Your order</h3>
        <div id="order_review" className="woocommerce-checkout-review-order">
          <table className="shop_table woocommerce-checkout-review-order-table">
            <thead><tr><th className="product-name">Product</th><th className="product-total">Subtotal</th></tr></thead>
            <tbody>
              {cart.items.map((i) => (
                <tr key={i.item_id} className="cart_item">
                  <td className="product-name">{i.name}&nbsp;<strong className="product-quantity">&times;&nbsp;{i.quantity}</strong></td>
                  <td className="product-total">{money(i.line_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="cart-subtotal"><th>Subtotal</th><td>{money(cart.subtotal)}</td></tr>
              {cart.coupons.map((c) => <tr key={c.code} className={`cart-discount coupon-${c.code}`}><th>Coupon: {c.code}</th><td>-{money(c.amount)}</td></tr>)}
              <tr className="order-total"><th>Total</th><td><strong>{money(cart.total)}</strong></td></tr>
            </tfoot>
          </table>
          <div id="payment" className="woocommerce-checkout-payment">
            <ul className="wc_payment_methods payment_methods methods">
              <li className="wc_payment_method payment_method_pending">
                <input id="payment_method_pending" type="radio" className="input-radio" name="payment_method" value="pending" defaultChecked />
                <label htmlFor="payment_method_pending">訂單成立（待付款）</label>
                <div className="payment_box payment_method_pending"><p>送出後建立「待付款」訂單，本站目前未串接線上金流，將由專人與您聯繫付款與出貨事宜。</p></div>
              </li>
            </ul>
            <div className="form-row place-order">
              <div className="woocommerce-terms-and-conditions-wrapper"><div className="woocommerce-privacy-policy-text"><p>Your personal data will be used to process your order, support your experience throughout this website, and for other purposes described in our privacy policy.</p></div></div>
              <button type="submit" className="button alt" name="woocommerce_checkout_place_order" id="place_order" value="Place order" disabled={busy}>Place order</button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
