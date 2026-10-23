import { getIndex, blogPosts, link, getContent } from "./data";
import { abs, SITE_NAME, SITE_URL, stripTags } from "./site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function rss() {
  const ix = await getIndex();
  const posts = blogPosts(ix).slice(0, 10);
  const items = await Promise.all(posts.map(async (p) => {
    const content = await getContent(p.id);
    return `<item><title>${esc(p.title)}</title><link>${abs(link(p))}</link><pubDate>${new Date(p.published_at || Date.now()).toUTCString()}</pubDate><guid isPermaLink="false">${SITE_URL}/?p=${p.id}</guid><description><![CDATA[${stripTags(p.excerpt || content).slice(0, 300)}]]></description><content:encoded><![CDATA[${content}]]></content:encoded></item>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${SITE_NAME}</title><atom:link href="${SITE_URL}/feed/" rel="self" type="application/rss+xml" /><link>${SITE_URL}</link><description>台灣藝術高粱第一品牌</description><language>zh-TW</language>${items.join("")}</channel></rss>`;
}
