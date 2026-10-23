import { Fragment } from "react";
import Link from "next/link";
import Shell, { BASE_BODY, TAIL_BODY, LAYOUT, PageHeader, ContentWrap, EmptySidebar, type Crumb } from "../Shell";
import { type Post, type SiteIndex, getContent, link, mediaById, productOf, termsOf, termLink, priceInfo, isPurchasable, qtyRulesFor, adjacentProducts, sortProducts, visibleProducts, objectsInTerm, type Term } from "@/lib/data";
import { ProductList, ShopToolbar, Pagination, PriceHtml, productClasses } from "../woo";
import ProductGallery from "../ProductGallery";
import AddToCartForm from "../AddToCartForm";

const SHOP_BODY = "woocommerce woocommerce-page";

export function shopQuery(sp: Record<string, string | string[] | undefined>) {
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) || "";
  const orderby = ["menu_order", "popularity", "date", "price", "price-desc", "rating"].includes(one("orderby")) ? one("orderby") : "menu_order";
  const perPage = ["12", "24", "all"].includes(one("products-per-page")) ? one("products-per-page") : "12";
  const q: Record<string, string> = {};
  if (one("orderby")) q.orderby = orderby;
  if (one("products-per-page")) q["products-per-page"] = perPage;
  if (one("product_cat")) q.product_cat = one("product_cat");
  return { orderby, perPage, query: q, productCat: one("product_cat") };
}

/** Product archive: /shop-2/ (shop page), /product-category/x/, /product-tag/x/ */
export function ShopArchive({ ix, term, page, sp, base }: { ix: SiteIndex; term: Term | null; page: number; sp: Record<string, string | string[] | undefined>; base: string }) {
  const { orderby, perPage, query, productCat } = shopQuery(sp);
  let list = visibleProducts(ix);
  let filterTerm: Term | null = term;
  if (!filterTerm && productCat) filterTerm = ix.terms.find((t) => t.taxonomy === "product_cat" && t.slug === productCat) || null;
  if (filterTerm) {
    const ids = objectsInTerm(ix, filterTerm.id);
    // include children categories
    ix.terms.filter((t) => t.parent_id === filterTerm!.id).forEach((c) => objectsInTerm(ix, c.id).forEach((x) => ids.add(x)));
    list = list.filter((p) => ids.has(p.id));
  }
  list = sortProducts(ix, list, orderby);
  const per = perPage === "all" ? Math.max(1, list.length) : Number(perPage);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const slice = list.slice((page - 1) * per, page * per);
  const qs = Object.keys(query).length ? "?" + new URLSearchParams(query).toString() : "";

  const isShop = !term;
  const title = isShop ? "Products" : term!.name;
  const crumbs: Crumb[] = isShop ? [{ label: "Shop" }] : term!.taxonomy === "product_tag" ? [{ label: `Products tagged “${term!.name}”` }] : [{ label: term!.name }];
  const body = isShop
    ? `archive post-type-archive post-type-archive-product ${BASE_BODY.replace("woocommerce-js", "")} woocommerce-shop ${SHOP_BODY} woocommerce-js ${LAYOUT.fullScreen} ${TAIL_BODY}`
    : `archive tax-${term!.taxonomy} term-${term!.slug} term-${term!.id} ${SHOP_BODY} ${BASE_BODY} ${LAYOUT.left} ${TAIL_BODY}`;
  return (
    <Shell bodyClass={body} header={<PageHeader title={title} crumbs={crumbs} subheading={isShop ? <p>This is where you can browse products in this store.</p> : undefined} />}>
      <ContentWrap contentClass="clr site-content" sidebars={isShop ? null : <EmptySidebar side="right" />}>
        <article className="entry-content entry clr">
          <header className="woocommerce-products-header">
            {term?.description ? <div className="term-description" dangerouslySetInnerHTML={{ __html: term.description }} /> : null}
          </header>
          {slice.length ? (
            <>
              <div className="woocommerce-notices-wrapper" />
              <ShopToolbar base={base} orderby={orderby} perPage={perPage} query={query} />
              <ProductList ix={ix} posts={slice} />
              <Pagination base={base} page={page} pages={pages} query={qs} woo />
            </>
          ) : (
            <p className="woocommerce-info">No products were found matching your selection.</p>
          )}
        </article>
      </ContentWrap>
    </Shell>
  );
}

/** Single product */
export async function ProductView({ ix, post }: { ix: SiteIndex; post: Post }) {
  const prod = productOf(ix, post.id)!;
  const content = await getContent(post.id);
  const imgIds = [post.featured_media_id, ...(prod.gallery_image_ids || [])].filter(Boolean) as number[];
  const images = imgIds.map((id) => mediaById(ix, id)).filter(Boolean).map((m) => ({ src: m!.public_url, alt: m!.alt_text || "", w: m!.width, h: m!.height, title: m!.title }));
  const cats = termsOf(ix, post.id, "product_cat");
  const tags = termsOf(ix, post.id, "product_tag");
  const { prev, next } = adjacentProducts(ix, post);
  const catIds = new Set(cats.map((c) => c.id));
  const related = visibleProducts(ix).filter((p) => p.id !== post.id && termsOf(ix, p.id, "product_cat").some((t) => catIds.has(t.id)));
  // WooCommerce shows 3 random related products; use a stable pseudo-random pick per product
  const seeded = related.map((p) => ({ p, k: ((p.id * 9301 + post.id * 49297) % 233280) })).sort((a, b) => a.k - b.k).slice(0, 3).map((x) => x.p);
  const upsells = (prod.upsell_ids || []).map((id) => ix.posts.find((p) => p.id === id && p.status === "publish")).filter(Boolean) as Post[];

  // variable product data
  const attrs = ix.attrValues.filter((a) => a.product_id === post.id && a.used_for_variations).sort((a, b) => a.position - b.position).map((a) => {
    const g = a.attribute_id ? ix.attributes.find((x) => x.id === a.attribute_id) : null;
    const key = g ? `pa_${g.slug}` : a.name.toLowerCase().replace(/\s+/g, "-");
    const opts = a.options.map((o) => {
      const t = g ? ix.terms.find((t) => t.taxonomy === key && t.slug === o) : null;
      return { value: o, label: t?.name || o };
    });
    return { key, name: g?.name || a.name, options: opts };
  });
  const variations = ix.variations.filter((v) => v.product_id === post.id).map((v) => {
    const pi = priceInfo(v);
    return { id: v.id, attributes: v.attributes || {}, price: pi.price, regular: pi.regular, sale: pi.sale, onSale: pi.onSale, stock_status: v.stock_status, stock_quantity: v.stock_quantity, manage_stock: v.manage_stock, sku: v.sku, image: mediaById(ix, v.image_id)?.public_url || null, description: v.description };
  });
  const rules = qtyRulesFor(ix, post.id).map((r) => ({ min_qty: r.min_qty, max_qty: r.max_qty, discount_type: r.discount_type, amount: Number(r.amount), name: r.name }));
  const pi = priceInfo(prod);
  const attrsVisible = ix.attrValues.filter((a) => a.product_id === post.id && a.visible && !a.used_for_variations);

  const thumb = (p: Post | null) => mediaById(ix, p?.featured_media_id);
  const body = `wp-singular product-template-default single single-product postid-${post.id} ${SHOP_BODY} ${BASE_BODY} ${LAYOUT.fullWidth} ${TAIL_BODY}`;
  return (
    <Shell bodyClass={body}
      floatingBar={
        <div className="owp-floating-bar">
          <div className="container clr">
            <div className="left"><p className="selected">Selected:</p><h2 className="entry-title" itemProp="name">{post.title}</h2></div>
            <div className="right">
              <div className="product_price"><p className="price">{pi.has ? <PriceHtml ix={ix} id={post.id} /> : null}</p></div>
              <button type="submit" className="button top">Select Options</button>
            </div>
          </div>
        </div>
      }
      header={<PageHeader title={post.title} crumbs={[{ label: post.title }]} />}>
      <ContentWrap contentClass="clr site-content">
        <article className="entry-content entry clr">
          <div className="woocommerce-notices-wrapper" />
          <div id={`product-${post.id}`} className={`entry has-media owp-thumbs-layout-horizontal owp-btn-normal owp-tabs-layout-horizontal has-no-thumbnails has-product-nav ${productClasses(ix, post, "first")}`}>
            <div className="owp-product-nav-wrap clr">
              <ul className="owp-product-nav">
                {prev ? (
                  <li className="prev-li">
                    <Link href={link(prev)} className="owp-nav-link prev" rel="next"><i className=" fa fa-angle-left" aria-hidden="true" role="img" /></Link>
                    <Link href={link(prev)} className="owp-nav-text prev-text">Previous Product</Link>
                    <div className="owp-nav-thumb"><Link title={prev.title} href={link(prev)}>{thumb(prev) ? <img width={100} height={100} src={thumb(prev)!.public_url} className="attachment-shop_thumbnail size-shop_thumbnail wp-post-image" alt="" /> : null}</Link></div>
                  </li>
                ) : null}
                {next ? (
                  <li className="next-li">
                    <Link href={link(next)} className="owp-nav-text next-text">Next Product</Link>
                    <Link href={link(next)} className="owp-nav-link next" rel="next"><i className=" fa fa-angle-right" aria-hidden="true" role="img" /></Link>
                    <div className="owp-nav-thumb"><Link title={next.title} href={link(next)}>{thumb(next) ? <img width={100} height={100} src={thumb(next)!.public_url} className="attachment-shop_thumbnail size-shop_thumbnail wp-post-image" alt="" /> : null}</Link></div>
                  </li>
                ) : null}
              </ul>
            </div>
            {pi.onSale ? <span className="onsale">Sale!</span> : null}
            <ProductGallery images={images} />
            <div className="summary entry-summary">
              <h2 className="single-post-title product_title entry-title" itemProp="name">{post.title}</h2>
              <p className="price"><PriceHtml ix={ix} id={post.id} /></p>
              <div className="woocommerce-product-details__short-description" dangerouslySetInnerHTML={{ __html: prod.short_description }} />
              <AddToCartForm productId={post.id} title={post.title} type={prod.product_type} purchasable={isPurchasable(prod)} stockStatus={prod.stock_status} stockQty={prod.stock_quantity} manageStock={prod.manage_stock}
                soldIndividually={prod.sold_individually} minQty={prod.min_qty} maxQty={prod.max_qty} step={prod.qty_step} basePrice={pi.price} attributes={attrs} variations={variations} rules={rules} />
              <div className="product_meta">
                {prod.sku ? <span className="sku_wrapper">SKU: <span className="sku">{prod.sku}</span></span> : null}
                {cats.length ? <span className="posted_in">{cats.length > 1 ? "Categories" : "Category"}: {cats.map((c, i) => <Fragment key={c.id}>{i ? ", " : ""}<Link href={termLink(c)} rel="tag">{c.name}</Link></Fragment>)}</span> : null}
                {tags.length ? <span className="tagged_as">{tags.length > 1 ? "Tags" : "Tag"}: {tags.map((c, i) => <Fragment key={c.id}>{i ? ", " : ""}<Link href={termLink(c)} rel="tag">{c.name}</Link></Fragment>)}</span> : null}
              </div>
            </div>
            <div className="clear-after-summary clr" />
            <div className="woocommerce-tabs wc-tabs-wrapper">
              <ul className="tabs wc-tabs" role="tablist">
                <li className="description_tab active" id="tab-title-description" role="tab" aria-controls="tab-description"><a href="#tab-description">Description </a></li>
                {attrsVisible.length ? <li className="additional_information_tab" id="tab-title-additional_information" role="tab" aria-controls="tab-additional_information"><a href="#tab-additional_information">Additional information </a></li> : null}
              </ul>
              <div className="woocommerce-Tabs-panel woocommerce-Tabs-panel--description panel entry-content wc-tab" id="tab-description" role="tabpanel" aria-labelledby="tab-title-description">
                <h2>Description</h2>
                <div dangerouslySetInnerHTML={{ __html: content }} />
              </div>
              {attrsVisible.length ? (
                <div className="woocommerce-Tabs-panel woocommerce-Tabs-panel--additional_information panel entry-content wc-tab" id="tab-additional_information" role="tabpanel" style={{ display: "none" }}>
                  <h2>Additional information</h2>
                  <table className="woocommerce-product-attributes shop_attributes"><tbody>
                    {attrsVisible.map((a) => <tr key={a.id} className="woocommerce-product-attributes-item"><th className="woocommerce-product-attributes-item__label">{a.name}</th><td className="woocommerce-product-attributes-item__value"><p>{a.options.join(", ")}</p></td></tr>)}
                  </tbody></table>
                </div>
              ) : null}
            </div>
            {upsells.length ? <section className="up-sells upsells products"><h2>You may also like&hellip;</h2><ProductList ix={ix} posts={upsells} /></section> : null}
            {seeded.length ? (
              <section className="related products">
                <h2>Related products</h2>
                <ProductList ix={ix} posts={seeded} />
              </section>
            ) : null}
          </div>
        </article>
      </ContentWrap>
    </Shell>
  );
}
