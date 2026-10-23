import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/admin/commerce";
import { customerAction } from "../../../actions";
import { Badge, Notice, fmtDate, money, type SP } from "@/components/admin/ui";

export const metadata = { title: "顧客" };

export default async function Customer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const c = await getCustomer(Number(id)).catch(() => null);
  if (!c) notFound();
  const b = c.billing || {};
  return (
    <>
      <h1>{c.display_name || c.email} <Link className="btn" href="/admin/customers/">← 顧客列表</Link></h1>
      <Notice sp={sp} />
      <div className="grid2">
        <form action={customerAction} className="card">
          <input type="hidden" name="id" value={c.id} />
          <p className="muted">ID {c.id} · {c.email} · 註冊 {fmtDate(c.date_registered)} · {c.auth_user_id ? "已連結登入帳號" : "未連結登入帳號"}</p>
          <div className="cols">
            <div><label>姓</label><input type="text" name="last_name" defaultValue={c.last_name} /></div>
            <div><label>名</label><input type="text" name="first_name" defaultValue={c.first_name} /></div>
            <div><label>顯示名稱</label><input type="text" name="display_name" defaultValue={c.display_name || ""} /></div>
          </div>
          <h2 style={{ marginTop: 16 }}>帳單資料</h2>
          <div className="cols">
            {[["phone", "電話"], ["company", "公司"], ["postcode", "郵遞區號"], ["state", "縣市"], ["city", "鄉鎮市區"], ["address_1", "地址"], ["address_2", "地址 2"], ["country", "國家"]].map(([k, l]) => <div key={k}><label>{l}</label><input type="text" name={`billing_${k}`} defaultValue={b[k] || ""} /></div>)}
          </div>
          <div className="actions"><button className="btn btn-p">更新顧客</button></div>
        </form>
        <div className="card">
          <h2>訂單紀錄（{c.orders.length}）</h2>
          {c.orders.length ? c.orders.map((o: any) => <p key={o.id}><Link href={`/admin/orders/${o.id}/`}>#{o.id}</Link> <Badge s={o.status} /> {money(o.total)} <span className="muted">{fmtDate(o.date_created)}</span></p>) : <p className="muted">尚無訂單</p>}
        </div>
      </div>
    </>
  );
}
