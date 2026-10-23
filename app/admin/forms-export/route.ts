import { getAdmin } from "@/lib/admin/guard";
import { listSubmissions, submissionsCsv } from "@/lib/admin/site";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url);
  const res = await listSubmissions({ form_id: Number(u.searchParams.get("form")) || undefined, status: u.searchParams.get("status") || "any", limit: 5000 });
  return new Response(submissionsCsv(res.items), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="form-submissions-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
