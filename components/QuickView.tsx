"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "./useCart";

type QV = { id: number; title: string; link: string; images: { src: string; alt: string }[]; short_description: string; sku: string | null; price: { has: boolean; regular: number | null; sale: number | null; price: number | null; onSale: boolean }; categories: { name: string; link: string }[] };

/** OceanWP "Quick View" modal (owp-qv-wrap) */
export default function QuickView() {
  const [data, setData] = useState<QV | null>(null);
  const [loading, setLoading] = useState(false);
  const close = () => { setData(null); setLoading(false); document.documentElement.classList.remove("owp-qv-open"); };
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".owp-quick-view");
      if (!a) return;
      e.preventDefault();
      const id = a.dataset.product_id || a.getAttribute("data-product_id");
      setLoading(true);
      document.documentElement.classList.add("owp-qv-open");
      fetch(`/api/quick-view/?id=${id}`).then((r) => r.json()).then((d) => setData(d)).finally(() => setLoading(false));
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("click", onClick);
    document.addEventListener("keyup", onKey);
    return () => { document.removeEventListener("click", onClick); document.removeEventListener("keyup", onKey); };
  }, []);
  const visible = !!data || loading;
  return (
    <div id="owp-qv-wrap" className={visible ? "is-visible" : ""} style={{ display: visible ? "block" : "none" }}>
      <div className="owp-qv-container">
        <div className="owp-qv-content-wrap">
          <div className="owp-qv-content-inner">
            <a href="#" className="owp-qv-close" aria-label="Close quick preview" onClick={(e) => { e.preventDefault(); close(); }}>×</a>
            <div id="owp-qv-content" className="woocommerce single-product">
              {data ? (
                <div className="product">
                  <div className="images owp-qv-image">
                    {data.images[0] ? <img src={data.images[0].src} alt={data.images[0].alt} /> : null}
                  </div>
                  <div className="summary entry-summary">
                    <div className="summary-content">
                      <h2 className="single-post-title product_title entry-title">{data.title}</h2>
                      <p className="price">{data.price.has ? (data.price.onSale ? <><del>{money(data.price.regular)}</del> <ins>{money(data.price.sale)}</ins></> : money(data.price.price)) : null}</p>
                      <div className="woocommerce-product-details__short-description" dangerouslySetInnerHTML={{ __html: data.short_description }} />
                      <Link href={data.link} className="button" onClick={close}>Read more</Link>
                      <div className="product_meta">
                        {data.sku ? <span className="sku_wrapper">SKU: <span className="sku">{data.sku}</span></span> : null}
                        {data.categories.length ? <span className="posted_in">Category: {data.categories.map((c, i) => <span key={c.link}>{i ? ", " : ""}<Link href={c.link} rel="tag" onClick={close}>{c.name}</Link></span>)}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="owp-qv-overlay" onClick={close} />
    </div>
  );
}
