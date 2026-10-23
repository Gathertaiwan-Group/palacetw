// WordPress oEmbed card (/<permalink>/embed/), rewritten here by proxy.ts. Mirrors wp-includes/theme-compat/embed-content.php.
import { getIndex, setting } from "@/lib/data";
import { resolve } from "@/lib/resolve";
import { SITE_NAME, SITE_URL, abs } from "@/lib/site";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  // after the proxy rewrite req.url can still be the original /<permalink>/embed/ URL
  const u = new URL(req.url);
  const m = u.pathname.match(/^\/(.+\/)embed\/?$/);
  const raw = u.searchParams.get("path") || (m && !u.pathname.startsWith("/api/") ? "/" + m[1] : "/");
  const ix = await getIndex();
  const r = resolve(ix, raw.split("/").filter(Boolean));
  const post = r.kind === "post" || r.kind === "product" ? r.post : "page" in r && r.page && !("num" in r && r.num > 1) ? r.page : null;
  if (!post) return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

  const url = abs(post.path || "/");
  const title = esc(post.title);
  let excerpt = (post.excerpt || "").replace(/<\/?p[^>]*>/g, "").trim();
  const more = /\s*\[(&hellip;|…)\]\s*$/.test(excerpt);
  if (more) excerpt = excerpt.replace(/\s*\[(&hellip;|…)\]\s*$/, " &hellip;");
  const icon = setting<{ url?: string }>(ix, "site_icon", {}).url;
  const comments = ix.commentCounts[post.id] || 0;
  const id = post.id;
  const uid = `${id}-${Math.floor(Math.random() * 1e10)}`;
  const secret = Math.random().toString(36).slice(2, 12).replace(/[^a-z0-9]/gi, "a").padEnd(10, "x");
  const shareHtml = esc(`<blockquote class="wp-embedded-content" data-secret="${secret}"><a href="${url}">${post.title}</a></blockquote><iframe sandbox="allow-scripts" security="restricted" src="${url}embed/#?secret=${secret}" width="600" height="400" title="${post.title} &#8212; ${SITE_NAME}" data-secret="${secret}" frameborder="0" marginwidth="0" marginheight="0" scrolling="no" class="wp-embedded-content"></iframe>`);
  const cls = (post.meta?.class_list as string[] | undefined)?.join(" ") || `post-${id} ${post.post_type} type-${post.post_type} status-publish`;

  const html = `<!DOCTYPE html>
<html lang="zh-TW" class="no-js">
<head>
<title>${title} - ${SITE_NAME}</title>
<meta charset="utf-8">
<meta name="robots" content="noindex, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="stylesheet" href="/wp/wp-embed-template.css">
</head>
<body class="wp-singular single single-${post.post_type} postid-${id} wp-embed-responsive">
<div class="wp-embed ${esc(cls)}">
<p class="wp-embed-heading"><a href="${url}" target="_top">${title}</a></p>
<div class="wp-embed-excerpt"><p>${excerpt}${more ? ` <a href="${url}" class="wp-embed-more" target="_top">閱讀全文 <span class="screen-reader-text">${title}</span></a>` : ""}</p></div>
<div class="wp-embed-footer">
<div class="wp-embed-site-title"><a href="${SITE_URL}" target="_top">${icon ? `<img src="${esc(icon)}" width="32" height="32" alt="" class="wp-embed-site-icon">` : ""}<span>${SITE_NAME}</span></a></div>
<div class="wp-embed-meta">
<div class="wp-embed-comments"><a href="${url}#respond" target="_top"><span class="dashicons dashicons-admin-comments"></span> ${comments} <span class="screen-reader-text">則留言</span></a></div>
<div class="wp-embed-share"><button type="button" class="wp-embed-share-dialog-open" aria-label="開啟分享對話方塊"><span class="dashicons dashicons-share"></span></button></div>
</div>
</div>
</div>
<div class="wp-embed-share-dialog hidden" role="dialog" aria-label="分享選項">
<div class="wp-embed-share-dialog-content">
<div class="wp-embed-share-dialog-text">
<ul class="wp-embed-share-tabs" role="tablist">
<li class="wp-embed-share-tab-button wp-embed-share-tab-button-wordpress" role="presentation"><button type="button" role="tab" aria-controls="wp-embed-share-tab-wordpress-${uid}" aria-selected="true" tabindex="0">以 WordPress 內容網址嵌入</button></li>
<li class="wp-embed-share-tab-button wp-embed-share-tab-button-html" role="presentation"><button type="button" role="tab" aria-controls="wp-embed-share-tab-html-${uid}" aria-selected="false" tabindex="-1">以 HTML 程式碼嵌入</button></li>
</ul>
<div id="wp-embed-share-tab-wordpress-${uid}" class="wp-embed-share-tab" role="tabpanel" aria-hidden="false">
<input type="text" value="${url}" class="wp-embed-share-input" aria-label="網址" tabindex="0" readonly>
<p class="wp-embed-share-description">複製這個網址並在你的 WordPress 網站貼上以嵌入內容</p>
</div>
<div id="wp-embed-share-tab-html-${uid}" class="wp-embed-share-tab" role="tabpanel" aria-hidden="true">
<textarea class="wp-embed-share-input" aria-label="HTML" tabindex="0" readonly>${shareHtml}</textarea>
<p class="wp-embed-share-description">複製這段程式碼並在你的網站貼上以嵌入內容</p>
</div>
</div>
<button type="button" class="wp-embed-share-dialog-close" aria-label="關閉分享對話方塊"><span class="dashicons dashicons-no"></span></button>
</div>
</div>
<script src="/wp/wp-embed-template.min.js"></script>
</body>
</html>`;
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, follow" } });
}
