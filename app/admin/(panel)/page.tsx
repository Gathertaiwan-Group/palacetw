import Link from "next/link";
import { dashboardCounts, listAudit } from "@/lib/admin/site";
import { listOrders } from "@/lib/admin/commerce";
import { publishDue } from "@/lib/admin/posts";
import { Badge, fmtDate, money } from "@/components/admin/ui";

export const metadata = { title: "控制台" };

export default async function Dashboard() {
  await publishDue().catch(() => 0);
  const [c, orders, log] = await Promise.all([dashboardCounts(), listOrders({ limit: 5 }), listAudit({ limit: 8 })]);
  const stats: [string, number, string][] = [
    ["文章", c.posts, "/admin/posts/?type=post"], ["頁面", c.pages, "/admin/posts/?type=page"], ["商品", c.products, "/admin/products/"],
    ["媒體", c.media, "/admin/media/"], ["訂單", c.orders, "/admin/orders/"], ["待處理訂單", c.pendingOrders, "/admin/orders/?status=processing"],
    ["顧客", c.customers, "/admin/customers/"], ["優惠券", c.coupons, "/admin/coupons/"], ["未讀表單", c.unreadSubmissions, "/admin/forms/"], ["轉址", c.redirects, "/admin/redirects/"],
  ];
  return (
    <>
      <h1>控制台</h1>
      <div className="cols" style={{ marginBottom: 16 }}>
        {stats.map(([l, n, href]) => <Link key={l} href={href} className="stat"><b>{n}</b>{l}</Link>)}
      </div>
      <div className="grid2">
        <div className="card">
          <h2>最新訂單</h2>
          {orders.items.length ? (
            <table className="list"><tbody>
              {orders.items.map((o: any) => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}/`}>#{o.order_number || o.id}</Link> {[o.billing?.last_name, o.billing?.first_name].filter(Boolean).join("")}</td><td><Badge s={o.status} /></td><td>{money(o.total)}</td><td className="muted">{fmtDate(o.date_created)}</td></tr>)}
            </tbody></table>
          ) : <p className="muted">尚無訂單。舊站的訂單、顧客與優惠券將在第三階段由資料庫備份匯入。</p>}
        </div>
        <div className="card">
          <h2>快速動作</h2>
          <p><Link className="btn btn-p" href="/admin/posts/new/?type=post">撰寫文章</Link> <Link className="btn" href="/admin/products/new/">新增商品</Link></p>
          <p><Link className="btn" href="/admin/posts/new/?type=page">新增頁面</Link> <Link className="btn" href="/admin/media/">上傳媒體</Link></p>
          <h2 style={{ marginTop: 16 }}>最近活動</h2>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {log.items.map((a: any) => <li key={a.id} className="muted">{fmtDate(a.created_at)} · {a.actor} · {a.action} {a.entity_id ? `#${a.entity_id}` : ""}</li>)}
          </ul>
          <p><Link href="/admin/audit/">全部稽核紀錄 →</Link></p>
        </div>
      </div>
    </>
  );
}
