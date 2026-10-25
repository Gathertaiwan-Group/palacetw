import Link from "next/link";
import { readNotice } from "@/lib/cart";

/** WooCommerce notices wrapper; shows the one-shot notice left by a no-JS add-to-cart (app/api/cart/form). */
export default async function FlashNotice() {
  const n = await readNotice();
  return (
    <div className="woocommerce-notices-wrapper">
      {n ? (
        <div className={n.ok ? "woocommerce-message" : "woocommerce-error"} role="alert">
          {n.ok ? <Link href="/cart-2/" className="button wc-forward">View cart</Link> : null} {n.text.replace(/&hellip;/g, "…")}
        </div>
      ) : null}
    </div>
  );
}

