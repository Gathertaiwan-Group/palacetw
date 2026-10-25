import { Fragment } from "react";
import { imgProps, SIZES } from "@/lib/img";
import Link from "next/link";
import type { ReactNode } from "react";
import { type Post, type SiteIndex, link, mediaById, priceInfo, productOf, termsOf, termLink, isPurchasable } from "@/lib/data";
import { stripTags, money } from "@/lib/site";
import AddToCartButton from "./AddToCartButton";

export function Amount({ v }: { v: number | null }) {
  if (v === null || v === undefined) return null;
  return (
    <span className="woocommerce-Price-amount amount"><bdi><span className="woocommerce-Price-currencySymbol">&#36;</span>{Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</bdi></span>
  );
}

export function PriceHtml({ ix, id }: { ix: SiteIndex; id: number }) {
  const prod = productOf(ix, id);
  if (!prod) return null;
  if (prod.product_type === "variable") {
    const prices = ix.variations.filter((v) => v.product_id === id).map((v) => priceInfo(v).price).filter((x): x is number => x !== null);
    if (!prices.length) return null;
    const min = Math.min(...prices), max = Math.max(...prices);
    return <>{min === max ? <Amount v={min} /> : <><Amount v={min} /> &ndash; <Amount v={max} /></>}</>;
  }
  const pi = priceInfo(prod);
  if (!pi.has) return null;
  if (pi.onSale) return <><del aria-hidden="true"><Amount v={pi.regular} /></del> <span className="screen-reader-text">Original price was: {money(pi.regular)}.</span><ins aria-hidden="true"><Amount v={pi.sale} /></ins><span className="screen-reader-text">Current price is: {money(pi.sale)}.</span></>;
  return <Amount v={pi.price} />;
}

export function productClasses(ix: SiteIndex, post: Post, extra = "") {
  const prod = productOf(ix, post.id);
  const cats = termsOf(ix, post.id, "product_cat").map((t) => `product_cat-${t.slug}`).join(" ");
  const tags = termsOf(ix, post.id, "product_tag").map((t) => `product_tag-${t.slug}`).join(" ");
  const pi = priceInfo(prod);
  return [
    "product", "type-product", `post-${post.id}`, `status-${post.status}`, extra, prod?.stock_status || "instock", cats, tags,
    pi.onSale ? "sale" : "", prod?.featured ? "featured" : "", post.featured_media_id ? "has-post-thumbnail" : "", "shipping-taxable",
    isPurchasable(prod) ? "purchasable" : "", `product-type-${prod?.product_type || "simple"}`,
  ].filter(Boolean).join(" ");
}

function EntryImage({ ix, post, href }: { ix: SiteIndex; post: Post; href: string }) {
  const img = mediaById(ix, post.featured_media_id);
  return (
    <div className="woo-entry-image clr">
      <Link href={href} className="woocommerce-LoopProduct-link">
        {img ? <img {...imgProps(img, SIZES.card)} width={265} height={331} className="woo-entry-image-main" alt={post.title} itemProp="image" /> : <img width={265} height={331} src="/wp/placeholder.png" className="woo-entry-image-main" alt="Placeholder" />}
      </Link>
      <a href="#" id={`product_id_${post.id}`} className="owp-quick-view" data-product_id={post.id}><i className=" icon-eye" aria-hidden="true" role="img" /> Quick View</a>
    </div>
  );
}

/** `desc`: OceanWP prints <li class="woo-desc"> only in the shop/archive loop (for list view); the related/up-sell
 *  loops on single product pages don't have it. */
export function ProductCard({ ix, post, pos, cols = 3, desc = true }: { ix: SiteIndex; post: Post; pos: number; cols?: number; desc?: boolean }) {
  const prod = productOf(ix, post.id);
  const href = link(post);
  const cats = termsOf(ix, post.id, "product_cat");
  const first = pos % cols === 0 ? "first" : pos % cols === cols - 1 ? "last" : "";
  const pi = priceInfo(prod);
  const purch = isPurchasable(prod);
  const variable = prod?.product_type === "variable";
  return (
    <li className={`entry has-media has-product-nav col span_1_of_${cols} owp-content-center owp-thumbs-layout-horizontal owp-btn-normal owp-tabs-layout-horizontal has-no-thumbnails ${productClasses(ix, post, first)}`}>
      <div className="product-inner clr">
        <EntryImage ix={ix} post={post} href={href} />
        <ul className="woo-entry-inner clr">
          <li className="image-wrap"><EntryImage ix={ix} post={post} href={href} /></li>
          <li className="category">{cats.map((c, i) => <Fragment key={c.id}>{i ? ", " : ""}<Link href={termLink(c)} rel="tag">{c.name}</Link></Fragment>)}</li>
          <li className="title"><h2><Link href={href}>{post.title}</Link></h2></li>
          <li className="price-wrap">{pi.has || variable ? <span className="price"><PriceHtml ix={ix} id={post.id} /></span> : null}</li>
          <li className="rating" />
          {desc ? <li className="woo-desc">{stripTags(prod?.short_description || "")}</li> : null}
          <li className="btn-wrap clr">
            {purch && !variable ? (
              <AddToCartButton productId={post.id} sku={prod?.sku || ""} title={post.title} href={href} />
            ) : (
              <Link href={href} data-quantity="1" className={`button product_type_${prod?.product_type || "simple"}`} data-product_id={post.id} data-product_sku={prod?.sku || ""} aria-label={`Read more about “${post.title}”`} rel="nofollow">
                {variable ? "Select options" : prod?.stock_status === "outofstock" ? "Read more" : "Read more"}
              </Link>
            )}
          </li>
        </ul>
      </div>
    </li>
  );
}

export function ProductList({ ix, posts, cols = 3, desc = true }: { ix: SiteIndex; posts: Post[]; cols?: number; desc?: boolean }) {
  return (
    <ul className="products oceanwp-row clr grid tablet-col tablet-2-col">
      {posts.map((p, i) => <ProductCard key={p.id} ix={ix} post={p} pos={i} cols={cols} desc={desc} />)}
    </ul>
  );
}

export function ShopToolbar({ base, orderby, perPage, query }: { base: string; orderby: string; perPage: string; query: Record<string, string> }) {
  const opts: [string, string][] = [["menu_order", "Default sorting"], ["popularity", "Sort by popularity"], ["date", "Sort by latest"], ["price", "Sort by price: low to high"], ["price-desc", "Sort by price: high to low"]];
  const hidden = Object.entries(query).filter(([k]) => !["orderby", "paged"].includes(k));
  return (
    <div className="oceanwp-toolbar clr">
      <nav className="oceanwp-grid-list">
        <a href="#" id="oceanwp-grid" title="Grid view" className="active grid-btn"><i className=" icon-grid" aria-hidden="true" role="img" /></a>
        <a href="#" id="oceanwp-list" title="List view" className=" list-btn"><i className=" icon-list" aria-hidden="true" role="img" /></a>
      </nav>
      <form className="woocommerce-ordering" method="get" action={base}>
        {/* OceanWP's customSelect(): the real select is transparent and sits over span.theme-select (bordered box + arrow) */}
        <select name="orderby" className="orderby hasCustomSelect" aria-label="Shop order" defaultValue={orderby}
          style={{ opacity: 0, position: "absolute", height: 34, fontSize: 13, appearance: "menulist-button", width: "100%", left: 0, top: 0, zIndex: 2, cursor: "pointer" }}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="theme-select orderby" style={{ display: "inline-block" }}>
          <span className="theme-selectInner" style={{ display: "inline-block" }}>{(opts.find(([v]) => v === orderby) || opts[0])[1]}</span>
        </span>
        <input type="hidden" name="paged" value="1" />
        {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      </form>
      <ul className="result-count">
        <li className="view-title">View:</li>
        <li><a className={`view-first${perPage === "12" ? " active" : ""}`} href={`${base}?products-per-page=12`}>12</a></li>
        <li><a className={`view-second${perPage === "24" ? " active" : ""}`} href={`${base}?products-per-page=24`}>24</a></li>
        <li><a className={`view-all${perPage === "all" ? " active" : ""}`} href={`${base}?products-per-page=all`}>All</a></li>
      </ul>
    </div>
  );
}

/** WordPress paginate_links() output as used by OceanWP */
export function Pagination({ base, page, pages, query = "", woo = false }: { base: string; page: number; pages: number; query?: string; woo?: boolean }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}page/${n}/`) + query;
  const nums: (number | "dots")[] = [];
  for (let n = 1; n <= pages; n++) {
    // OceanWP: mid_size 3, end_size 1; WooCommerce loop pagination: mid_size 3, end_size 3
    const end = woo ? 3 : 1;
    if (n <= end || n > pages - end || Math.abs(n - page) <= 3) nums.push(n);
    else if (nums[nums.length - 1] !== "dots") nums.push("dots");
  }
  const list: ReactNode = (
    <ul className="page-numbers">
      {page > 1 ? <li><a className="prev page-numbers" href={href(page - 1)}>{woo ? null : <span className="screen-reader-text">Go to the previous page</span>}<i className=" fa fa-angle-left" aria-hidden="true" role="img" /></a></li> : null}
      {nums.map((n, i) => n === "dots" ? <li key={`d${i}`}><span className="page-numbers dots">&hellip;</span></li> : (
        <li key={n}>{n === page ? <span aria-current="page" className="page-numbers current">{n}</span> : <a className="page-numbers" href={href(n)}>{n}</a>}</li>
      ))}
      {page < pages ? <li><a className="next page-numbers" href={href(page + 1)}>{woo ? null : <span className="screen-reader-text">Go to the next page</span>}<i className=" fa fa-angle-right" aria-hidden="true" role="img" /></a></li> : null}
    </ul>
  );
  return woo ? <nav className="woocommerce-pagination">{list}</nav> : <div className="oceanwp-pagination clr">{list}</div>;
}
