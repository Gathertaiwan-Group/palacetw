import { rss } from "@/lib/feed";

export const revalidate = 300;
export async function GET() {
  return new Response(await rss(), { headers: { "content-type": "application/rss+xml; charset=UTF-8" } });
}
