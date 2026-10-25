import { sitemapIndex, xml } from "@/lib/sitemap";

export const revalidate = 300;
/** Rank Math serves /sitemap.xml as the same sitemap index as /sitemap_index.xml (old site: 3 child sitemaps). */
export async function GET() {
  return xml(await sitemapIndex());
}
