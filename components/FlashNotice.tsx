"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const NOTICE_COOKIE = "pt_notice";

/**
 * WooCommerce notices wrapper; shows the one-shot notice left by a no-JS add-to-cart (app/api/cart/form).
 * Read on the client so the product / shop pages stay statically cached; the cookie is removed once shown.
 */
export default function FlashNotice() {
  const [n, setN] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(NOTICE_COOKIE + "="))?.slice(NOTICE_COOKIE.length + 1);
    if (!raw) return;
    document.cookie = `${NOTICE_COOKIE}=; path=/; max-age=0`;
    try {
      const v = JSON.parse(decodeURIComponent(raw));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (typeof v?.text === "string") setN({ ok: !!v.ok, text: v.text });
    } catch { /* ignore */ }
  }, []);
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
