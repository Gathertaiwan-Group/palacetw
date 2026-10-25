import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { db } from "@/lib/supabase";
import { getIndex, published, visibleProducts, objectsInTerm, blogPosts, setting, type SiteIndex } from "@/lib/data";
import { resolve, blogFor, type Route } from "@/lib/resolve";
import { postMetadata, termMetadata, simpleMetadata, JsonLd, postJsonLd, collectionJsonLd, ProductHeadExtras, PagingLinks } from "@/lib/seo";
import { PageView, PostView, BlogArchive } from "@/components/views/content";
import { ShopArchive, ProductView, shopQuery } from "@/components/views/shop";
import { CartView, CheckoutView, OrderReceived, AccountView } from "@/components/views/commerce";
import { stripTags } from "@/lib/site";
import { renderSearch } from "@/components/views/search";
import { viewCart } from "@/lib/cart";
import DynamicReload from "@/components/DynamicReload";

/**
 * Shared renderer for the public site.
 *  - "static": app/(site)/page.tsx and app/(site)/[...path] — ISR (revalidate 300 s, expired on every admin / MCP write);
 *    no cookies / searchParams.
 *  - "dynamic": app/(site)/dyn-render/[[...path]] — proxy.ts rewrites requests that need per-request rendering there
 *    (query strings such as ?s= / ?orderby= / order-received ?key=, and the cart / checkout / my-account pages).
 */
export type Mode = "static" | "dynamic";
export type SP = Record<string, string | string[] | undefined>;

/** Route kinds that read cookies (cart, session, customer) and therefore never render statically. */
export const DYNAMIC_KINDS = new Set(["cart", "checkout", "orderReceived", "account"]);

async function front() {
  const ix = await getIndex();
  const reading = setting<{ page_on_front?: number }>(ix, "reading", {});
  const page = ix.posts.find((p) => p.id === (reading.page_on_front || 396))!;
  return { ix, page };
}

function productCount(ix: SiteIndex, termId: number) {
  const ids = objectsInTerm(ix, termId);
  return visibleProducts(ix).filter((p) => ids.has(p.id)).length;
}

export async function homeMetadata(sp: SP): Promise<Metadata> {
  if (typeof sp.s === "string") return simpleMetadata(`${sp.s}`, "noindex, follow");
  const { page } = await front();
  return postMetadata(page);
}

export async function renderHome(sp: SP) {
  if (typeof sp.s === "string") return renderSearch(sp.s, 1);
  const { ix, page } = await front();
  return <><JsonLd data={postJsonLd(page)} /><PageView ix={ix} page={page} isHome /></>;
}

export async function pathMetadata(path: string[], mode: Mode): Promise<Metadata> {
  const ix = await getIndex();
  const r = resolve(ix, path);
  if (mode === "static" && DYNAMIC_KINDS.has(r.kind)) return { robots: "noindex, follow" };
  switch (r.kind) {
    case "page": case "post": case "product": return postMetadata(r.kind === "page" ? r.page : r.post);
    case "checkout": {
      // WooCommerce sends an empty-cart checkout to the cart page, so the old snapshot's head is the Cart page's
      const cartPage = published(ix, "page").find((p) => p.id === 1036);
      if (r.page.id === 1037 && cartPage && (await viewCart()).count === 0) return { ...postMetadata(cartPage), robots: "noindex, follow" };
      return { ...postMetadata(r.page), robots: "noindex, follow" };
    }
    case "cart": case "account": return { ...postMetadata(r.page), robots: "noindex, follow" };
    case "orderReceived": return simpleMetadata("Order received");
    case "shop": return postMetadata(r.page, { pageNum: r.num });
    case "blog": {
      const first = blogPosts(ix)[0];
      return postMetadata(r.page, { pageNum: r.num, fallbackDesc: first ? stripTags(first.excerpt) : undefined });
    }
    case "productTerm": return termMetadata(r.term, productCount(ix, r.term.id), "Products", r.base, r.num);
    case "term": return termMetadata(r.term, blogFor(ix, r).length, "文章", r.base, r.num);
    case "author": return { ...simpleMetadata(r.author.display_name, "noindex, follow") };
    case "date": return simpleMetadata(`${r.year} 年${r.month ? ` ${r.month} 月` : ""}`, "noindex, follow");
    default: return simpleMetadata("Page Not Found");
  }
}

function ld(ix: SiteIndex, r: Route) {
  switch (r.kind) {
    case "page": case "cart": case "checkout": case "account": return <JsonLd data={postJsonLd(r.page)} />;
    case "post": return <JsonLd data={postJsonLd(r.post)} />;
    case "product": return <><JsonLd data={postJsonLd(r.post)} /><ProductHeadExtras ix={ix} p={r.post} /></>;
    case "shop": case "blog": return <JsonLd data={postJsonLd(r.page)} />;
    case "productTerm": return <JsonLd data={collectionJsonLd(r.term.name, r.base, [{ name: r.term.name, url: r.base }])} />;
    case "term": return <JsonLd data={collectionJsonLd(r.term.name, r.base, [{ name: r.term.name, url: r.base }])} />;
    default: return null;
  }
}

export async function renderPath(path: string[], sp: SP, mode: Mode) {
  const ix = await getIndex();
  const r = resolve(ix, path);
  if (path.length === 2 && path[0] === "page" && /^\d+$/.test(path[1]) && typeof sp.s === "string") return renderSearch(sp.s, Number(path[1]));
  // a cart / checkout / account URL that proxy.ts did not route to the dynamic renderer (e.g. right after a slug change)
  if (mode === "static" && DYNAMIC_KINDS.has(r.kind)) return <DynamicReload />;
  switch (r.kind) {
    case "page": return <>{ld(ix, r)}<PageView ix={ix} page={r.page} /></>;
    case "post": return <>{ld(ix, r)}<PostView ix={ix} post={r.post} /></>;
    case "product": return <>{ld(ix, r)}<ProductView ix={ix} post={r.post} /></>;
    case "shop": case "productTerm": {
      const term = r.kind === "productTerm" ? r.term : null;
      const { perPage } = shopQuery(sp);
      let n = visibleProducts(ix).length;
      if (term) n = productCount(ix, term.id);
      const per = perPage === "all" ? Math.max(1, n) : Number(perPage);
      const pages = Math.max(1, Math.ceil(n / per));
      if (r.num > pages) notFound();
      return <>{ld(ix, r)}<PagingLinks base={r.base} num={r.num} pages={pages} /><ShopArchive ix={ix} term={term} page={r.num} sp={sp} base={r.base} /></>;
    }
    case "blog": case "term": case "author": case "date": {
      const posts = blogFor(ix, r);
      const pages = Math.max(1, Math.ceil(posts.length / 6));
      if (r.num > pages) notFound();
      if (r.kind !== "term" && r.kind !== "blog" && !posts.length) notFound();
      const title = r.kind === "blog" ? r.page.title : r.kind === "term" ? r.term.name : r.kind === "author" ? r.author.display_name : `${r.year} 年${r.month ? ` ${r.month} 月` : ""}`;
      const body = r.kind === "blog" ? "blog" : r.kind === "term" ? `archive ${r.term.taxonomy === "category" ? `category category-${r.term.slug} category-${r.term.id}` : `tag tag-${r.term.slug} tag-${r.term.id}`}` : r.kind === "author" ? `archive author author-${r.author.slug} author-${r.author.id}` : "archive date";
      const empty = r.kind === "term" && r.term.taxonomy === "post_tag" ? "There aren't any posts currently published under this tag." : "There aren't any posts currently published in this category.";
      return <>{ld(ix, r)}<PagingLinks base={r.base} num={r.num} pages={pages} /><BlogArchive ix={ix} posts={posts} title={title} crumbs={[{ label: title }]} base={r.base} page={r.num} bodyClass={body} emptyText={empty} /></>;
    }
    case "cart": return <>{ld(ix, r)}<CartView page={r.page} /></>;
    case "checkout": {
      const cartPage = published(ix, "page").find((p) => p.id === 1036) || null;
      return <>{ld(ix, r)}<CheckoutView ix={ix} page={r.page} cartPage={cartPage} /></>;
    }
    case "orderReceived": {
      const key = typeof sp.key === "string" ? sp.key : "";
      return <OrderReceived page={r.page} orderId={r.id} orderKey={key} />;
    }
    case "account": return <>{ld(ix, r)}<AccountView page={r.page} sub={r.sub} arg={r.arg} register={sp.action === "register"} /></>;
    default: {
      // redirects managed in /admin/redirects (and automatic ones after a slug change)
      const raw = "/" + path.join("/") + "/";
      const cands = Array.from(new Set([raw, decodeURIComponent(raw), raw.replace(/\/$/, "")]));
      const { data } = await db().from("redirects").select("target,status_code").in("source_path", cands).limit(1);
      const hit = data?.[0];
      if (hit && hit.status_code !== 410 && hit.target) {
        if (hit.status_code === 301 || hit.status_code === 308) permanentRedirect(hit.target);
        redirect(hit.target);
      }
      notFound();
    }
  }
}
