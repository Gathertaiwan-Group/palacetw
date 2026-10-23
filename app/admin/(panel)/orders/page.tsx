import Link from "next/link";
import { listOrders, orderStatusCounts, ORDER_STATUSES } from "@/lib/admin/commerce";
import { bulkOrderStatusAction } from "../../actions";
import { Badge, Notice, Pager, fmtDate, money, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "訂單" };

export default async function Orders({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = one(sp.status) || "any";
  const { limit, offset } = pageOf(sp, 30);
  const [res, counts] = await Promise.all([
    listOrders({ status, search: one(sp.s), from: one(sp.from) ? `${one(sp.from)}T00:00:00+08:00` : undefined, to: one(sp.to) ? `${one(sp.to)}T23:59:59+08:00` : undefined, limit, offset }),
    orderStatusCounts(),
  ]);
  const self = `/admin/orders/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  const all = Object.entries(counts).filter(([k]) => k !== "trash").reduce((a, [, n]) => a + n, 0);
  return (
    <>
      <h1>訂單 <a className="btn" href={`/admin/orders-export/?${new URLSearchParams({ status, s: one(sp.s), from: one(sp.from), to: one(sp.to) })}`}>匯出 CSV</a></h1>
      <Notice sp={sp} />
      <ul className="subsubsub">
        <li>{status === "any" ? <span className="cur">全部</span> : <Link href="/admin/orders/">全部</Link>} <span className="muted">({all})</span></li>
        {Object.entries(ORDER_STATUSES).filter(([k]) => counts[k] || k === status).map(([k, l]) => <li key={k}>{status === k ? <span className="cur">{l}</span> : <Link href={`/admin/orders/?status=${k}`}>{l}</Link>} <span className="muted">({counts[k] || 0})</span></li>)}
      </ul>
      <form className="filters" method="get" action="/admin/orders/">
        {status !== "any" ? <input type="hidden" name="status" value={status} /> : null}
        <input type="date" name="from" defaultValue={one(sp.from)} aria-label="起日" /> ~ <input type="date" name="to" defaultValue={one(sp.to)} aria-label="迄日" />
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="訂單編號、email、姓名、電話" />
        <button className="btn">篩選</button>
      </form>
      <form action={bulkOrderStatusAction}>
        <input type="hidden" name="_back" value={self} />
        <div className="filters">
          <select name="status" defaultValue=""><option value="">批次變更狀態為…</option>{Object.entries(ORDER_STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="btn">套用</button>
          <Pager base="/admin/orders/" sp={sp} total={res.total} limit={limit} offset={offset} />
        </div>
        <table className="list">
          <thead><tr><th style={{ width: 28 }}></th><th>訂單</th><th>日期</th><th>狀態</th><th>付款方式</th><th>總計</th></tr></thead>
          <tbody>
            {res.items.length ? res.items.map((o: any) => (
              <tr key={o.id}>
                <td><input type="checkbox" name="ids" value={o.id} aria-label={`選取訂單 ${o.id}`} /></td>
                <td><Link href={`/admin/orders/${o.id}/`}><strong>#{o.order_number || o.id} {[o.billing?.last_name, o.billing?.first_name].filter(Boolean).join("")}</strong></Link><div className="muted">{o.billing?.email} {o.billing?.phone}</div></td>
                <td className="muted">{fmtDate(o.date_created)}</td>
                <td><Badge s={o.status} /></td>
                <td className="muted">{o.payment_method_title || o.payment_method || "—"}</td>
                <td>{money(o.total)}</td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">沒有訂單。舊站訂單將於第三階段由資料庫備份匯入。</td></tr>}
          </tbody>
        </table>
      </form>
    </>
  );
}
