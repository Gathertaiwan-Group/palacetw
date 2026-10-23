import { entries, urlset, xml } from "@/lib/sitemap";

export const revalidate = 300;
export async function GET() {
  return xml(urlset(await entries("post")));
}
