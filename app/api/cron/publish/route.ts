import { publishDue } from "@/lib/admin/posts";

export const dynamic = "force-dynamic";

/** Vercel Cron: publish scheduled (status=future) content whose date has passed. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const n = await publishDue();
  return Response.json({ published: n });
}
