import type { Metadata } from "next";
import { type Post, type SiteIndex, type Term, mediaById, productOf, priceInfo, setting } from "./data";
import { SITE_NAME, SITE_URL, abs, stripTags } from "./site";

const ROBOTS_INDEX = "index, follow, max-snippet:-1, max-video-preview:-1, max-image-preview:large";

export function absolutize<T>(v: T): T {
  if (Array.isArray(v)) return v.map(absolutize) as T;
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      o[k] = typeof x === "string" && x.startsWith("/") && ["@id", "url", "item", "target"].includes(k) ? SITE_URL + x : absolutize(x);
    }
    return o as T;
  }
  return v;
}

export function postMetadata(p: Post, opts: { pageNum?: number; fallbackDesc?: string } = {}): Metadata {
  const s = p.seo || {};
  const suffix = opts.pageNum && opts.pageNum > 1 ? ` - 第 ${opts.pageNum} 頁` : "";
  const title = (s.title || `${p.title} - ${SITE_NAME}`).replace(new RegExp(` - ${SITE_NAME}$`), `${suffix} - ${SITE_NAME}`);
  const desc = s.description || undefined;
  const ex = stripTags(p.excerpt || "").replace(/\s*\[(…|&hellip;)\]\s*$/, " […]");
  const ogDesc = s.og_description || s.description || opts.fallbackDesc || (ex ? ex : undefined);
  const canonical = s.canonical ? (opts.pageNum && opts.pageNum > 1 ? `${s.canonical}page/${opts.pageNum}/` : s.canonical) : undefined;
  const img = s.og_image as string | undefined;
  const ogType = s.og_type === "website" || s.og_type === "article" ? s.og_type : undefined;
  return {
    title,
    description: desc,
    robots: s.robots || ROBOTS_INDEX,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      locale: "zh_TW", ...(ogType ? { type: ogType } : {}), title: s.og_title || title, description: ogDesc, url: canonical || p.path || undefined, siteName: SITE_NAME,
      ...(img ? { images: [{ url: img, alt: p.title }] } : {}),
      ...(ogType === "article" ? { publishedTime: p.published_at || undefined, modifiedTime: p.modified_at || undefined } : {}),
    },
    twitter: { card: "summary_large_image", title: s.og_title || title, description: ogDesc, ...(img ? { images: [img] } : {}) },
  };
}

export function termMetadata(t: Term, count: number, label: string, base: string, pageNum = 1): Metadata {
  const suffix = pageNum > 1 ? ` - 第 ${pageNum} 頁` : "";
  const title = `${t.name} 彙整${suffix} - ${SITE_NAME}`;
  const indexable = count > 0;
  const canonical = indexable ? (pageNum > 1 ? `${base}page/${pageNum}/` : base) : undefined;
  return {
    title,
    description: t.description ? stripTags(t.description) : undefined,
    robots: indexable ? ROBOTS_INDEX : "noindex, follow",
    alternates: canonical ? { canonical } : undefined,
    openGraph: { locale: "zh_TW", type: "article", title, url: base, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title },
    other: indexable ? { "twitter:label1": label, "twitter:data1": String(count) } : {},
  };
}

export function simpleMetadata(title: string, robots = "noindex, follow"): Metadata {
  return { title: `${title} - ${SITE_NAME}`, robots, openGraph: { locale: "zh_TW", title: `${title} - ${SITE_NAME}`, siteName: SITE_NAME }, twitter: { card: "summary_large_image" } };
}

const ORG = { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME };
const WEBSITE = { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: SITE_NAME, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "zh-TW" };

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" className="rank-math-schema" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function postJsonLd(p: Post) {
  const s = p.seo?.schema_jsonld;
  if (s) return absolutize({ "@context": "https://schema.org", ...s });
  return { "@context": "https://schema.org", "@graph": [ORG, WEBSITE, { "@type": "WebPage", "@id": `${abs(p.path || "/")}#webpage`, url: abs(p.path || "/"), name: p.title, isPartOf: { "@id": `${SITE_URL}/#website` }, inLanguage: "zh-TW" }] };
}

export function collectionJsonLd(name: string, base: string, crumbs: { name: string; url: string }[], home = true) {
  const url = abs(base);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG, { ...WEBSITE, ...(home ? { potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/?s={search_term_string}`, "query-input": "required name=search_term_string" } } : {}) },
      { "@type": "BreadcrumbList", "@id": `${url}#breadcrumb`, itemListElement: [{ "@type": "ListItem", position: "1", item: { "@id": SITE_URL, name: "首頁" } }, ...crumbs.map((c, i) => ({ "@type": "ListItem", position: String(i + 2), item: { "@id": abs(c.url), name: c.name } }))] },
      { "@type": "CollectionPage", "@id": `${url}#webpage`, url, name: `${name} - ${SITE_NAME}`, isPartOf: { "@id": `${SITE_URL}/#website` }, inLanguage: "zh-TW", breadcrumb: { "@id": `${url}#breadcrumb` } },
    ],
  };
}

/** Extra head tags Next's Metadata API cannot express (og:type=product, product price labels, rel=next/prev). React hoists these into <head>. */
export function ProductHeadExtras({ ix, p }: { ix: SiteIndex; p: Post }) {
  const prod = productOf(ix, p.id);
  const pi = priceInfo(prod);
  const img = mediaById(ix, p.featured_media_id);
  return (
    <>
      <meta property="og:type" content="product" />
      {img ? <><meta property="og:image:width" content={String(img.width || "")} /><meta property="og:image:height" content={String(img.height || "")} /><meta property="og:image:alt" content={p.title} /><meta property="og:image:type" content={img.mime_type} /></> : null}
      <meta name="twitter:label1" content="Price" />
      <meta name="twitter:data1" content={`$${(pi.price ?? 0).toFixed(2)}`} />
      <meta name="twitter:label2" content="Availability" />
      <meta name="twitter:data2" content={prod?.stock_status === "outofstock" ? "Out of stock" : "In stock"} />
      {pi.has ? <><meta property="product:price:amount" content={String(pi.price)} /><meta property="product:price:currency" content={String(setting<{ currency?: string }>(ix, "woocommerce", {}).currency || "TWD")} /></> : null}
      <meta property="product:availability" content={prod?.stock_status === "outofstock" ? "out of stock" : "instock"} />
    </>
  );
}

export function PagingLinks({ base, num, pages, query = "" }: { base: string; num: number; pages: number; query?: string }) {
  return (
    <>
      {num > 1 ? <link rel="prev" href={abs((num === 2 ? base : `${base}page/${num - 1}/`) + query)} /> : null}
      {num < pages ? <link rel="next" href={abs(`${base}page/${num + 1}/` + query)} /> : null}
    </>
  );
}
