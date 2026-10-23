import { notFound } from "next/navigation";
import Shell, { BASE_BODY, LAYOUT, TAIL_BODY, PageHeader, ContentWrap } from "@/components/Shell";
import { requireAdmin } from "@/lib/admin/guard";
import { getPost } from "@/lib/admin/posts";
import { sb } from "@/lib/admin/core";
import { money } from "@/lib/site";

export const metadata = { title: "預覽", robots: { index: false, follow: false } };

/** Draft / scheduled preview rendered inside the real site theme (admins only). */
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const post = await getPost(Number(id)).catch(() => null);
  if (!post) notFound();
  const [{ data: img }, { data: prod }] = await Promise.all([
    post.featured_media_id ? sb().from("media").select("public_url,width,height").eq("id", post.featured_media_id).maybeSingle() : Promise.resolve({ data: null }),
    post.post_type === "product" ? sb().from("products").select("*").eq("post_id", post.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isPage = post.post_type === "page";
  const el = (post.content || "").includes("data-elementor-type") ? ` elementor-page elementor-page-${post.id}` : "";
  const body = `wp-singular ${isPage ? `page page-id-${post.id}` : `single single-${post.post_type} postid-${post.id}`} ${BASE_BODY} ${LAYOUT.fullWidth} ${TAIL_BODY}${el}`;
  return (
    <>
      <link rel="stylesheet" href="/wp/theme.css" precedence="default" />
      <div style={{ position: "sticky", top: 0, zIndex: 99999, background: "#1d2327", color: "#fff", padding: "8px 16px", font: "13px/1.4 sans-serif", display: "flex", gap: 16 }}>
        <strong>預覽</strong>
        <span>狀態：{post.status}{post.status === "future" ? `（排程 ${new Date(post.published_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}）` : ""}</span>
        <a href={post.post_type === "product" ? `/admin/products/${post.id}/` : `/admin/posts/${post.id}/`} style={{ color: "#72aee6", marginLeft: "auto" }}>← 回到編輯</a>
      </div>
      <Shell bodyClass={body} header={isPage ? <PageHeader title={post.title} crumbs={[{ label: post.title }]} /> : undefined}>
        <ContentWrap>
          <article className={isPage ? "single-page-article clr" : "clr"}>
            {img && !isPage ? <div className="thumbnail"><img src={img.public_url} alt={post.title} width={img.width || undefined} height={img.height || undefined} /></div> : null}
            {!isPage ? <header className="entry-header clr"><h2 className="single-post-title entry-title">{post.title}</h2></header> : null}
            {prod ? (
              <div className="summary entry-summary">
                <p className="price">{prod.sale_price !== null ? <><del>{money(prod.regular_price)}</del> <ins>{money(prod.sale_price)}</ins></> : money(prod.regular_price)}</p>
                <div className="woocommerce-product-details__short-description" dangerouslySetInnerHTML={{ __html: prod.short_description || "" }} />
              </div>
            ) : null}
            <div className="entry clr entry-content" dangerouslySetInnerHTML={{ __html: post.content || "" }} />
          </article>
        </ContentWrap>
      </Shell>
    </>
  );
}
