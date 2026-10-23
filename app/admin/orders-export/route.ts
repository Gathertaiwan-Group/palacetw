import { getAdmin } from "@/lib/admin/guard";
import { listOrders } from "@/lib/admin/commerce";
import { submissionsCsv } from "@/lib/admin/site";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url);
  const from = u.searchParams.get("from"); const to = u.searchParams.get("to");
  const res = await listOrders({ status: u.searchParams.get("status") || "any", search: u.searchParams.get("s") || undefined, from: from ? `${from}T00:00:00+08:00` : undefined, to: to ? `${to}T23:59:59+08:00` : undefined, limit: 500 });
  const rows = res.items.map((o: any) => ({ id: o.id, created_at: o.date_created, status: o.status, page_url: null, data: { 訂單編號: o.order_number || o.id, 姓名: [o.billing?.last_name, o.billing?.first_name].filter(Boolean).join(""), email: o.billing?.email, 電話: o.billing?.phone, 付款方式: o.payment_method_title, 總計: o.total, 幣別: o.currency } }));
  return new Response(submissionsCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
