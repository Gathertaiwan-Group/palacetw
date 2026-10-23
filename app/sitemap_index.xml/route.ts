import { sitemapIndex, xml } from "@/lib/sitemap";

export const revalidate = 300;
export async function GET() {
  return xml(await sitemapIndex());
}
