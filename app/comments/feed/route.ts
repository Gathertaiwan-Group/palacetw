import { SITE_NAME, SITE_URL } from "@/lib/site";

export async function GET() {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME} 的留言</title><link>${SITE_URL}</link><description>台灣藝術高粱第一品牌</description><language>zh-TW</language></channel></rss>`, { headers: { "content-type": "application/rss+xml; charset=UTF-8" } });
}
