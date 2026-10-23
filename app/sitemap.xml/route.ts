import { entries, urlset, xml } from "@/lib/sitemap";

export const revalidate = 300;
/** Single combined sitemap (all indexable URLs); /sitemap_index.xml keeps the old Rank Math split. */
export async function GET() {
  const all = (await Promise.all(["page", "post", "product", "product_cat", "category"].map((k) => entries(k)))).flat();
  const seen = new Set<string>();
  return xml(urlset(all.filter((e) => (seen.has(e.loc) ? false : (seen.add(e.loc), true)))));
}
