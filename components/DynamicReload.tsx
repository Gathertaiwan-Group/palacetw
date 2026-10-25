"use client";
import { useEffect } from "react";

/**
 * Rendered by the static (ISR) renderer when it meets a cart / checkout / my-account URL that proxy.ts did not send to
 * the per-request renderer (only possible briefly after such a page's slug is changed). A query string makes
 * proxy.ts route the reload to app/(site)/dyn-render.
 */
export default function DynamicReload() {
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.has("_dyn")) return;
    u.searchParams.set("_dyn", "1");
    window.location.replace(u.toString());
  }, []);
  return <div className="woocommerce" style={{ minHeight: "40vh" }} />;
}
