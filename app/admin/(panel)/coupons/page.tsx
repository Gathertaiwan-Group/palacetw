import Link from "next/link";
import { listCoupons } from "@/lib/admin/commerce";
import { Notice, fmtDate, money, type SP } from "@/components/admin/ui";

export const metadata = { title: "優惠券" };
const TYPES: Record<string, string> = { percent: "百分比折扣", fixed_cart: "購物車固定折扣", fixed_product: "商品固定折扣" };

export default async function Coupons({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const list = await listCoupons();
  return (
    <>
      <h1>優惠券 <Link className="btn" href="/admin/coupons/new/">新增優惠券</Link></h1>
      <Notice sp={sp} />
      <table className="list">
        <thead><tr><th>優惠碼</th><th>折扣類型</th><th>金額</th><th>說明</th><th>使用／上限</th><th>到期日</th></tr></thead>
        <tbody>
          {list.length ? list.map((c: any) => (
            <tr key={c.id}>
              <td><Link href={`/admin/coupons/${c.id}/`}><strong>{c.code}</strong></Link>{c.status !== "publish" ? <span className="muted"> （{c.status}）</span> : null}</td>
              <td>{TYPES[c.discount_type] || c.discount_type}</td>
              <td>{c.discount_type === "percent" ? `${Number(c.amount)}%` : money(c.amount)}</td>
              <td className="muted">{c.description}</td>
              <td>{c.usage_count} / {c.usage_limit ?? "∞"}</td>
              <td className="muted">{c.date_expires ? fmtDate(c.date_expires) : "—"}</td>
            </tr>
          )) : <tr><td colSpan={6} className="muted">尚無優惠券。舊站優惠券將於第三階段由資料庫備份匯入。</td></tr>}
        </tbody>
      </table>
    </>
  );
}
