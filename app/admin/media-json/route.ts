import { getAdmin } from "@/lib/admin/guard";
import { listMedia } from "@/lib/admin/media";

export const dynamic = "force-dynamic";

/** Media library JSON for the editor / picker dialogs (admins only). */
export async function GET(req: Request) {
  if (!(await getAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const u = new URL(req.url);
  const r = await listMedia({ search: u.searchParams.get("s") || undefined, mime: u.searchParams.get("mime") || undefined, limit: 60, offset: Number(u.searchParams.get("offset")) || 0 });
  return Response.json(r, { headers: { "cache-control": "no-store" } });
}
