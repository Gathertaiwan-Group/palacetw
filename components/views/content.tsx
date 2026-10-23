import { Fragment } from "react";
import Link from "next/link";
import Shell, { BASE_BODY, TAIL_BODY, LAYOUT, PageHeader, ContentWrap, EmptySidebar, WidgetSidebar, type Crumb } from "../Shell";
import { type Post, type SiteIndex, getContent, termsOf, termLink, link, mediaById, blogPosts, productOf, getApprovedComments } from "@/lib/data";
import { wpDate, wpExcerpt, stripTags } from "@/lib/site";
import { Pagination } from "../woo";
import CommentForm from "../CommentForm";

export const PAGE_LAYOUT: Record<number, string> = {
  396: LAYOUT.fullScreen, 5: LAYOUT.fullScreen, 130: LAYOUT.fullScreen, 1035: LAYOUT.fullScreen,
  128: LAYOUT.fullWidth, 1185: LAYOUT.fullWidth, 298: LAYOUT.fullWidth, 1036: LAYOUT.fullWidth, 1037: LAYOUT.fullWidth, 10: LAYOUT.fullWidth, 31: LAYOUT.fullWidth,
  6: LAYOUT.both, 7: LAYOUT.both, 8: LAYOUT.both,
};

export function pageBody(p: Post, content: string, extra = "") {
  const el = content.includes("data-elementor-type") ? ` elementor-page elementor-page-${p.id}` : "";
  return `wp-singular page-template-default page page-id-${p.id} ${extra} ${BASE_BODY} ${PAGE_LAYOUT[p.id] || LAYOUT.fullWidth} ${TAIL_BODY}${el}`;
}

export function Sidebars({ layout }: { layout: string }) {
  if (layout === LAYOUT.both) return <><WidgetSidebar /><EmptySidebar side="right" /></>;
  if (layout === LAYOUT.right || layout === LAYOUT.left) return <EmptySidebar side="right" />;
  return null;
}

/** Elementor / classic page */
export async function PageView({ ix, page, isHome = false }: { ix: SiteIndex; page: Post; isHome?: boolean }) {
  const content = await getContent(page.id);
  const layout = PAGE_LAYOUT[page.id] || LAYOUT.fullWidth;
  return (
    <Shell isHome={isHome} bodyClass={(isHome ? "home " : "") + pageBody(page, content)} header={<PageHeader title={page.title} crumbs={isHome ? undefined : [{ label: page.title }]} />}>
      <ContentWrap sidebars={<Sidebars layout={layout} />}>
        <article className="single-page-article clr">
          <div className="entry clr" itemProp="text" dangerouslySetInnerHTML={{ __html: content }} />
        </article>
      </ContentWrap>
    </Shell>
  );
}

function Meta({ ix, post, variant }: { ix: SiteIndex; post: Post; variant: "single" | "entry" }) {
  const author = ix.authors.find((a) => a.id === post.author_id);
  const cats = termsOf(ix, post.id, "category");
  const comments = ix.commentCounts[post.id] || 0;
  return (
    <ul className={`meta ${variant === "single" ? "ospm-default" : "obem-default"} clr`} aria-label={variant === "entry" ? "Post details:" : undefined}>
      <li className="meta-author" itemProp="name"><span className="screen-reader-text">Post author:</span><i className=" icon-user" aria-hidden="true" role="img" /><Link href={`/author/${author?.slug || "admin"}/`} rel="author" itemProp="author" itemScope itemType="https://schema.org/Person">{author?.display_name || ""}</Link></li>
      <li className="meta-date" itemProp="datePublished"><span className="screen-reader-text">Post published:</span><i className=" icon-clock" aria-hidden="true" role="img" />{wpDate(post.date_local)}</li>
      {cats.length ? (
        <li className="meta-cat"><span className="screen-reader-text">Post category:</span><i className=" icon-folder" aria-hidden="true" role="img" />
          {cats.map((c, i) => <Fragment key={c.id}>{i ? <span className="owp-sep" aria-hidden="true">/</span> : null}<Link href={termLink(c)} rel="category tag">{c.name}</Link></Fragment>)}
        </li>
      ) : null}
      {post.comment_status === "open" ? (
        <li className="meta-comments"><span className="screen-reader-text">Post comments:</span><i className=" icon-bubble" aria-hidden="true" role="img" /><a href={`${link(post)}#respond`} className="comments-link">{comments} Comments</a></li>
      ) : null}
    </ul>
  );
}

function postClasses(ix: SiteIndex, p: Post) {
  const cats = termsOf(ix, p.id, "category").map((t) => `category-${t.slug}`);
  const tags = termsOf(ix, p.id, "post_tag").map((t) => `tag-${t.slug}`);
  return [`post-${p.id}`, "post", "type-post", `status-${p.status}`, "format-standard", p.featured_media_id ? "has-post-thumbnail" : "", "hentry", ...cats, ...tags, "entry", "owp-thumbs-layout-horizontal owp-btn-normal owp-tabs-layout-horizontal has-no-thumbnails has-product-nav"].filter(Boolean).join(" ");
}

/** Single blog post (OceanWP single layout with right sidebar) */
export async function PostView({ ix, post }: { ix: SiteIndex; post: Post }) {
  const content = await getContent(post.id);
  const comments = post.comment_status === "open" ? await getApprovedComments(post.id) : [];
  const tags = termsOf(ix, post.id, "post_tag");
  // OceanWP post navigation stays within the same category
  const myCats = new Set(termsOf(ix, post.id, "category").map((t) => t.id));
  const all = blogPosts(ix).filter((p) => p.id === post.id || termsOf(ix, p.id, "category").some((t) => myCats.has(t.id)));
  const i = all.findIndex((p) => p.id === post.id);
  const newer = i > 0 ? all[i - 1] : null;
  const older = i >= 0 && i < all.length - 1 ? all[i + 1] : null;
  const related = all.filter((p) => p.id !== post.id).slice(0, 2);
  const img = mediaById(ix, post.featured_media_id);
  const cats = termsOf(ix, post.id, "category").map((t) => `post-in-category-${t.slug}`).join(" ");
  const body = `wp-singular post-template-default single single-post postid-${post.id} single-format-standard ${BASE_BODY} ${LAYOUT.right} ${cats} ${TAIL_BODY}`;
  return (
    <Shell bodyClass={body} header={<PageHeader title="Blog" crumbs={[{ label: post.title }]} />}>
      <ContentWrap sidebars={<EmptySidebar side="right" />}>
        <article id={`post-${post.id}`}>
          {img ? <div className="thumbnail"><img src={img.public_url} alt={post.title} width={img.width || undefined} height={img.height || undefined} className="attachment-full size-full wp-post-image" /></div> : null}
          <header className="entry-header clr"><h2 className="single-post-title entry-title" itemProp="headline">{post.title}</h2></header>
          <Meta ix={ix} post={post} variant="single" />
          <div className="entry-content clr" itemProp="text" dangerouslySetInnerHTML={{ __html: content }} />
          <div className="post-tags clr">
            {tags.length ? <><span className="owp-tag-text">Tags: </span>{tags.map((t, k) => <Fragment key={t.id}>{k ? <span className="owp-sep">,</span> : null} <Link href={termLink(t)} rel="tag">{t.name}</Link></Fragment>)}</> : null}
          </div>
          {older || newer ? (
          <nav className="navigation post-navigation" aria-label="Read more articles">
            <h2 className="screen-reader-text">Read more articles</h2>
            <div className="nav-links">
              {older ? <div className="nav-previous"><Link href={link(older)} rel="prev"><span className="title"><i className=" fas fa-long-arrow-alt-left" aria-hidden="true" role="img" /> Previous Post</span><span className="post-title">{older.title}</span></Link></div> : null}
              {newer ? <div className="nav-next"><Link href={link(newer)} rel="next"><span className="title"><i className=" fas fa-long-arrow-alt-right" aria-hidden="true" role="img" /> Next Post</span><span className="post-title">{newer.title}</span></Link></div> : null}
            </div>
          </nav>
          ) : null}
          {related.length ? (
            <section id="related-posts" className="clr">
              <h3 className="theme-heading related-posts-title"><span className="text">You Might Also Like</span></h3>
              <div className="oceanwp-row clr">
                {related.map((r, k) => (
                  <article key={r.id} className={`related-post clr col span_1_of_2 col-${k + 1} ${postClasses(ix, r)}`}>
                    <h3 className="related-post-title"><Link href={link(r)} rel="bookmark">{r.title}</Link></h3>
                    <time className="published" dateTime={r.published_at || ""}><i className=" icon-clock" aria-hidden="true" role="img" />{wpDate(r.date_local)}</time>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {post.comment_status === "open" ? (
            <section id="comments" className="comments-area clr has-comments">
              {comments.length ? (
                <>
                  <h3 className="theme-heading comments-title"><span className="text">{comments.length} Comments</span></h3>
                  <ol className="comment-list">
                    {comments.map((c: any) => (
                      <li key={c.id} id={`comment-${c.id}`} className="comment">
                        <article className="comment-body"><div className="comment-content"><div className="comment-author">{c.author_name}</div><span className="comment-meta commentmetadata">{wpDate(c.created_at)}</span><div className="clr" dangerouslySetInnerHTML={{ __html: c.content }} /></div></article>
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}
              <CommentForm postId={post.id} />
            </section>
          ) : null}
        </article>
      </ContentWrap>
    </Shell>
  );
}

/** Blog index / category / tag / author / date archives (OceanWP blog grid, 2 columns, 6 per page) */
export function BlogArchive({ ix, posts, title, crumbs, base, page, bodyClass, emptyText }: { ix: SiteIndex; posts: Post[]; title: string; crumbs: Crumb[]; base: string; page: number; bodyClass: string; emptyText: string }) {
  const PER = 6;
  const pages = Math.max(1, Math.ceil(posts.length / PER));
  const slice = posts.slice((page - 1) * PER, page * PER);
  return (
    <Shell bodyClass={`${bodyClass} ${BASE_BODY} ${LAYOUT.fullWidth} ${TAIL_BODY}`} header={<PageHeader title={title} crumbs={crumbs} />}>
      <ContentWrap>
        {slice.length ? (
          <>
            <div id="blog-entries" className="entries clr oceanwp-row blog-grid">
              {slice.map((p, k) => {
                const img = mediaById(ix, p.featured_media_id);
                const ex = p.excerpt ? stripTags(p.excerpt) : "";
                return (
                  <article key={p.id} id={`post-${p.id}`} className={`blog-entry clr col span_1_of_2 col-${k + 1} ${img ? "" : "no-featured-image "}grid-entry ${postClasses(ix, p)}`}>
                    <div className="blog-entry-inner clr">
                      {img ? <div className="thumbnail"><Link href={link(p)} className="thumbnail-link"><img src={img.public_url} alt={p.title} className="attachment-full size-full wp-post-image" /></Link></div> : null}
                      <header className="blog-entry-header clr"><h2 className="blog-entry-title entry-title"><Link href={link(p)} rel="bookmark">{p.title}</Link></h2></header>
                      <Meta ix={ix} post={p} variant="entry" />
                      <div className="blog-entry-summary clr" itemProp="text"><p>{wpExcerpt(ex, 30)} </p></div>
                      <div className="blog-entry-readmore clr"><Link href={link(p)}>Continue Reading<span className="screen-reader-text">{p.title}</span><i className=" fa fa-angle-right" aria-hidden="true" role="img" /></Link></div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Pagination base={base} page={page} pages={pages} />
          </>
        ) : (
          <div className="page-content"><p>{emptyText}</p></div>
        )}
      </ContentWrap>
    </Shell>
  );
}

/** Search results (OceanWP search layout, right sidebar) */
export function SearchView({ ix, q, results, page }: { ix: SiteIndex; q: string; results: Post[]; page: number }) {
  const PER = 8; // old site: 47 results for "酒" over 6 pages, 8 per page
  const pages = Math.max(1, Math.ceil(results.length / PER));
  const slice = results.slice((page - 1) * PER, page * PER);
  const title = results.length ? `${results.length} Search Results Found` : "Nothing Found";
  return (
    <Shell bodyClass={`search ${results.length ? "search-results" : "search-no-results"} ${BASE_BODY} ${LAYOUT.right} ${TAIL_BODY}`}
      header={<PageHeader title={title} subheading={<>You searched for: &quot;{q}&quot;</>} crumbs={[{ label: `您正在搜尋 ${q}` }]} />}>
      <ContentWrap sidebars={<EmptySidebar side="right" />}>
        {slice.length ? (
          <>
            <div id="search-entries" className="clr">
              {slice.map((p) => {
                const img = mediaById(ix, p.featured_media_id);
                const prod = productOf(ix, p.id);
                // OceanWP prints the_excerpt() (already <p>-wrapped) inside its own <p>; browsers turn that into
                // <p></p><p>…</p><p></p>, which is where the old site's extra spacing comes from
                const summary = p.post_type === "product" ? (prod?.short_description || p.excerpt) : p.excerpt;
                return (
                  <article key={p.id} id={`post-${p.id}`} className={`post-${p.id} ${p.post_type} type-${p.post_type} status-publish entry ${img ? "has-media" : ""}`}>
                    <div className="search-entry-inner clr">
                      {img ? <div className="thumbnail"><Link href={link(p)} className="thumbnail-link"><img width={150} height={150} src={img.public_url} alt={p.title} className="attachment-thumbnail size-thumbnail wp-post-image" /></Link></div> : null}
                      <div className="search-entry-content clr">
                        <header className="search-entry-header clr"><h2 className="search-entry-title entry-title"><Link href={link(p)} rel="bookmark">{p.title}</Link></h2></header>
                        <div className="search-entry-summary clr" itemProp="text" dangerouslySetInnerHTML={{ __html: `<p>${summary || ""}</p>` }} />
                        <div className="search-entry-readmore clr"><Link href={link(p)}>Continue Reading<span className="screen-reader-text">{p.title}</span></Link></div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Pagination base="/" page={page} pages={pages} query={`?s=${encodeURIComponent(q)}`} />
          </>
        ) : (
          <div className="page-content">
            <h2 className="search-error-title">Nothing Found</h2>
            <p className="search-error-text">Sorry, but nothing matched your search terms. Please try again with some different keywords.</p>
            <form role="search" method="get" className="searchform" action="/">
              <label htmlFor="ocean-search-form-404"><span className="screen-reader-text">Search this website</span><input type="search" id="ocean-search-form-404" className="field" autoComplete="off" placeholder="Search" name="s" /></label>
            </form>
          </div>
        )}
      </ContentWrap>
    </Shell>
  );
}

export function NotFoundView() {
  return (
    <Shell bodyClass={`error404 ${BASE_BODY} ${LAYOUT.fullWidth} ${TAIL_BODY}`} header={<PageHeader title="404: Page Not Found" crumbs={[{ label: "404 錯誤：找不到頁面" }]} />}>
      <ContentWrap>
        <article className="entry clr">
          <div className="error404-content clr">
            <h2 className="error-title">This page could not be found!</h2>
            <p className="error-text">We are sorry. But the page you are looking for is not available.<br />Perhaps you can try a new search.</p>
            <form role="search" method="get" className="searchform" action="/">
              <label htmlFor="ocean-search-form-404"><span className="screen-reader-text">Search this website</span><input type="search" id="ocean-search-form-404" className="field" autoComplete="off" placeholder="Search" name="s" /></label>
            </form>
            <Link className="error-btn button" href="/">Back To Homepage</Link>
          </div>
        </article>
      </ContentWrap>
    </Shell>
  );
}
