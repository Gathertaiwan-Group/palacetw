"use client";
import { useEffect, useState } from "react";

type Img = { src: string; srcSet?: string; thumb?: string; alt: string; w: number | null; h: number | null; title: string };

const MAIN_SIZES = "(max-width: 768px) 100vw, 600px";

/** WooCommerce product gallery: flexslider (thumbnails), hover zoom and PhotoSwipe-style lightbox. */
export default function ProductGallery({ images }: { images: Img[] }) {
  const [idx, setIdx] = useState(0);
  const [lb, setLb] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ x: number; y: number; bw: number; bh: number } | null>(null);
  useEffect(() => {
    if (lb === null) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLb(null);
      if (e.key === "ArrowRight") setLb((i) => (i === null ? i : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setLb((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [lb, images.length]);
  if (!images.length) return <div className="woocommerce-product-gallery woocommerce-product-gallery--without-images images" />;
  const cur = images[idx];
  const slide = (
    <figure className="woocommerce-product-gallery__wrapper">
      <div data-thumb={cur.src} className="woocommerce-product-gallery__image flex-active-slide" style={{ position: "relative", overflow: "hidden" }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, bw: r.width, bh: r.height }); }}
        onMouseLeave={() => setZoom(null)}>
        <a href={cur.src} onClick={(e) => { e.preventDefault(); setLb(idx); }}>
          <img width={cur.w || 504} height={cur.h || 504} src={cur.src} srcSet={cur.srcSet} sizes={cur.srcSet ? MAIN_SIZES : undefined} className="wp-post-image" alt={cur.alt} title={cur.title} decoding="async" fetchPriority={idx === 0 ? "high" : undefined} />
        </a>
        {zoom && (cur.w || 0) > zoom.bw ? (
          <img role="presentation" alt="" src={cur.src} className="zoomImg" style={{ position: "absolute", top: -zoom.y * ((cur.h || 0) - zoom.bh), left: -zoom.x * ((cur.w || 0) - zoom.bw), opacity: 1, width: cur.w || undefined, height: cur.h || undefined, border: "none", maxWidth: "none", maxHeight: "none", pointerEvents: "none" }} />
        ) : null}
      </div>
    </figure>
  );
  return (
    <div className={`woocommerce-product-gallery woocommerce-product-gallery--with-images woocommerce-product-gallery--columns-4 images`} data-columns="4" style={{ opacity: 1 }}>
      <a href="#" role="button" className="woocommerce-product-gallery__trigger" aria-haspopup="dialog" aria-label="View full-screen image gallery" onClick={(e) => { e.preventDefault(); setLb(idx); }}>
        <span aria-hidden="true">🔍</span>
      </a>
      {/* flexslider only wraps the slides in .flex-viewport (margin-bottom 20px) when there is more than one image */}
      {images.length > 1 ? (
        <div className="flex-viewport" style={{ overflow: "hidden", position: "relative" }}>{slide}</div>
      ) : slide}
      {images.length > 1 ? (
        <ol className="flex-control-nav flex-control-thumbs">
          {images.map((im, i) => (
            <li key={i}><img src={im.thumb || im.src} alt={im.alt} width={100} height={100} loading="lazy" decoding="async" className={i === idx ? "flex-active" : ""} onClick={() => setIdx(i)} draggable={false} /></li>
          ))}
        </ol>
      ) : null}
      {lb !== null ? (
        <div className="pt-lightbox" role="dialog" aria-label="Image gallery" onClick={(e) => { if (e.target === e.currentTarget) setLb(null); }}>
          <span className="pt-count">{lb + 1} / {images.length}</span>
          <button className="pt-close" aria-label="Close (Esc)" onClick={() => setLb(null)}>×</button>
          {images.length > 1 ? <button className="pt-prev" aria-label="Previous" onClick={() => setLb((lb - 1 + images.length) % images.length)}>‹</button> : null}
          <img src={images[lb].src} alt={images[lb].alt} />
          {images.length > 1 ? <button className="pt-next" aria-label="Next" onClick={() => setLb((lb + 1) % images.length)}>›</button> : null}
        </div>
      ) : null}
    </div>
  );
}
