import Link from "next/link";
import { listCustomers } from "@/lib/admin/commerce";
import { Notice, Pager, fmtDate, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "顧客" };

export default async function Customers({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { limit, offset } = pageOf(sp, 50);
  const res = await listCustomers({ search: one(sp.s), limit, offset });
  return (
    <>
      <h1>顧客</h1>
      <Notice sp={sp} />
      <form className="filters" method="get" action="/admin/customers/"><input type="search" name="s" defaultValue={one(sp.s)} placeholder="email、姓名" /><button className="btn">搜尋</button></form>
      <Pager base="/admin/customers/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <table className="list">
        <thead><tr><th>姓名</th><th>Email</th><th>電話</th><th>註冊日期</th><th>最後活動</th></tr></thead>
        <tbody>
          {res.items.length ? res.items.map((c: any) => (
            <tr key={c.id}>
              <td><Link href={`/admin/customers/${c.id}/`}>{[c.last_name, c.first_name].filter(Boolean).join("") || c.display_name || c.username || `#${c.id}`}</Link>{c.is_paying_customer ? <span className="badge st-completed" style={{ marginLeft: 6 }}>付費顧客</span> : null}</td>
              <td>{c.email}</td><td className="muted">{c.billing?.phone || "—"}</td><td className="muted">{fmtDate(c.date_registered)}</td><td className="muted">{fmtDate(c.last_active)}</td>
            </tr>
          )) : <tr><td colSpan={5} className="muted">尚無顧客。舊站顧客將於第三階段由資料庫備份匯入。</td></tr>}
        </tbody>
      </table>
    </>
  );
}
