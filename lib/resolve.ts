import { type Post, type SiteIndex, type Term, findPost, findTerm, blogPosts } from "./data";
import { dec } from "./site";

export const CART_PAGES = [1036, 6];
export const CHECKOUT_PAGES = [1037, 7];
export const ACCOUNT_PAGES = [10, 8];
export const SHOP_PAGE = 1035;
export const BLOG_PAGE = 31;

export type Route =
  | { kind: "page"; page: Post }
  | { kind: "post"; post: Post }
  | { kind: "product"; post: Post }
  | { kind: "shop"; page: Post; num: number; base: string }
  | { kind: "productTerm"; term: Term; num: number; base: string }
  | { kind: "blog"; page: Post; num: number; base: string }
  | { kind: "term"; term: Term; num: number; base: string }
  | { kind: "author"; author: { id: number; slug: string; display_name: string }; num: number; base: string }
  | { kind: "date"; year: number; month: number | null; num: number; base: string }
  | { kind: "cart"; page: Post }
  | { kind: "checkout"; page: Post }
  | { kind: "orderReceived"; page: Post; id: number }
  | { kind: "account"; page: Post; sub: string; arg?: string }
  | { kind: "notfound" };

export function resolve(ix: SiteIndex, rawSegs: string[]): Route {
  let segs = rawSegs.map((s) => dec(s)).filter(Boolean);
  let num = 1;
  const pi = segs.length >= 2 ? segs[segs.length - 2] : null;
  if (pi === "page" && /^\d+$/.test(segs[segs.length - 1])) {
    num = Number(segs[segs.length - 1]);
    segs = segs.slice(0, -2);
    if (num < 1) return { kind: "notfound" };
  }
  const [a, b, c, d] = segs;
  const paged = num > 1;
  const enc = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());

  if (a === "product" && b && segs.length === 2 && !paged) {
    const post = findPost(ix, ["product"], b);
    return post ? { kind: "product", post } : { kind: "notfound" };
  }
  if ((a === "product-category" || a === "product-tag") && b && segs.length === 2) {
    const term = findTerm(ix, a === "product-category" ? "product_cat" : "product_tag", b);
    return term ? { kind: "productTerm", term, num, base: `/${a}/${enc(b)}/` } : { kind: "notfound" };
  }
  if ((a === "category" || a === "tag") && b && segs.length === 2) {
    const term = findTerm(ix, a === "category" ? "category" : "post_tag", b);
    return term ? { kind: "term", term, num, base: `/${a}/${enc(b)}/` } : { kind: "notfound" };
  }
  if (a === "author" && b && segs.length === 2) {
    // single author site; the old author slug was derived from an e-mail address
    const author = ix.authors.find((x) => x.slug === b) || (ix.authors.length === 1 ? ix.authors[0] : null);
    return author ? { kind: "author", author, num, base: `/author/${enc(b)}/` } : { kind: "notfound" };
  }
  if (a && /^\d{4}$/.test(a) && (!b || /^\d{1,2}$/.test(b)) && segs.length <= 2) {
    return { kind: "date", year: Number(a), month: b ? Number(b) : null, num, base: `/${a}/${b ? b + "/" : ""}` };
  }
  if (!a) return { kind: "notfound" };

  const page = findPost(ix, ["page"], a);
  if (page) {
    if (page.id === SHOP_PAGE && segs.length === 1) return { kind: "shop", page, num, base: `/${page.slug}/` };
    if (page.id === BLOG_PAGE && segs.length === 1) return { kind: "blog", page, num, base: `/${page.slug}/` };
    if (paged) return { kind: "notfound" };
    if (CART_PAGES.includes(page.id) && segs.length === 1) return { kind: "cart", page };
    if (CHECKOUT_PAGES.includes(page.id)) {
      if (segs.length === 1) return { kind: "checkout", page };
      if (b === "order-received" && c && /^\d+$/.test(c) && !d) return { kind: "orderReceived", page, id: Number(c) };
      return { kind: "notfound" };
    }
    if (ACCOUNT_PAGES.includes(page.id)) {
      const allowed = ["orders", "view-order", "edit-account", "lost-password", "customer-logout"];
      if (segs.length === 1) return { kind: "account", page, sub: "" };
      if (allowed.includes(b) && segs.length <= 3) return { kind: "account", page, sub: b, arg: c };
      return { kind: "notfound" };
    }
    if (segs.length === 1) return { kind: "page", page };
    // child page: /parent/child/
    const child = findPost(ix, ["page"], segs[segs.length - 1]);
    if (child && child.parent_id) return { kind: "page", page: child };
    return { kind: "notfound" };
  }
  if (segs.length === 1 && !paged) {
    const post = findPost(ix, ["post"], a);
    if (post) return { kind: "post", post };
  }
  return { kind: "notfound" };
}

export function blogFor(ix: SiteIndex, r: Route) {
  const all = blogPosts(ix);
  if (r.kind === "term") {
    const ids = new Set(ix.rels.filter((x) => x.term_id === r.term.id).map((x) => x.object_id));
    return all.filter((p) => ids.has(p.id));
  }
  if (r.kind === "author") return all.filter((p) => p.author_id === r.author.id);
  if (r.kind === "date") return all.filter((p) => p.date_local && Number(p.date_local.slice(0, 4)) === r.year && (!r.month || Number(p.date_local.slice(5, 7)) === r.month));
  return all;
}
