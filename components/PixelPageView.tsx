"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** PixelYourSite sent PageView on every page load; replicate on client-side navigations too. */
export default function PixelPageView() {
  const pathname = usePathname();
  useEffect(() => {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void };
    const send = () => w.fbq && w.fbq("track", "PageView");
    if (w.fbq) send(); else { const t = setTimeout(send, 800); return () => clearTimeout(t); }
  }, [pathname]);
  return null;
}
