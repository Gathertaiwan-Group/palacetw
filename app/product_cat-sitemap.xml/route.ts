import { entries, sitemapConfig, urlset, xml } from "@/lib/sitemap";

export const revalidate = 300;
/** Only served when settings.seo.sitemap_types includes "product_cat" (the old Rank Math site had taxonomy sitemaps off → 404). */
export async function GET() {
  if (!(await sitemapConfig()).types.includes("product_cat")) return new Response("Not Found", { status: 404, headers: { "x-robots-tag": "noindex" } });
  return xml(urlset(await entries("product_cat")));
}
