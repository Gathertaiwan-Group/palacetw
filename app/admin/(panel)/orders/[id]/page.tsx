import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrder, ORDER_STATUSES } from "@/lib/admin/commerce";
import { orderStatusAction, orderNoteAction, orderAddressAction } from "../../../actions";
import { Badge, Notice, fmtDate, money, type SP } from "@/components/admin/ui";

export const metadata = { title: "訂單明細" };
const ADDR: [string, string][] = [["last_name", "姓"], ["first_name", "名"], ["company", "公司"], ["phone", "電話"], ["email", "Email"], ["country", "國家"], ["state", "縣市"], ["city", "鄉鎮市區"], ["postcode", "郵遞區號"], ["address_1", "地址"], ["address_2", "地址 2"]];

function Address({ id, kind, a }: { id: number; kind: "billing" | "shipping"; a: Record<string, string> }) {
  return (
    <details className="card">
      <summary><strong>{kind === "billing" ? "帳單地址" : "運送地址"}</strong>：{[a?.last_name, a?.first_name].filter(Boolean).join("")} {[a?.postcode, a?.state, a?.city, a?.address_1, a?.address_2].filter(Boolean).join(" ")} {a?.phone} {a?.email}</summary>
      <form action={orderAddressAction}>
        <input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} />
        <div className="cols">{ADDR.filter(([k]) => kind === "billing" || (k !== "email")).map(([k, l]) => <div key={k}><label>{l}</label><input type="text" name={k} defaultValue={a?.[k] || ""} /></div>)}</div>
        <div className="actions"><button className="btn">儲存地址</button></div>
      </form>
    </details>
  );
}

export default async function Order({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const o = await getOrder(Number(id)).catch(() => null);
  if (!o) notFound();
  const lines = o.items.filter((i: any) => i.item_type === "line_item");
  const others = o.items.filter((i: any) => i.item_type !== "line_item");
  return (
    <>
      <h1>訂單 #{o.order_number || o.id} <Badge s={o.status} /> <Link className="btn" href="/admin/orders/">← 訂單列表</Link></h1>
      <Notice sp={sp} />
      <div className="grid2">
        <div>
          <div className="card">
            <p className="muted">建立：{fmtDate(o.date_created)} · 付款：{o.payment_method_title || o.payment_method || "未付款（未串接金流）"}{o.date_paid ? ` · 付款時間 ${fmtDate(o.date_paid)}` : ""}{o.transaction_id ? ` · 交易編號 ${o.transaction_id}` : ""}</p>
            <p>顧客：{o.customer ? <Link href={`/admin/customers/${o.customer.id}/`}>{o.customer.display_name || o.customer.email}</Link> : "訪客"}{o.customer_ip ? <span className="muted"> · IP {o.customer_ip}</span> : null}</p>
            {o.customer_note ? <p>顧客備註：{o.customer_note}</p> : null}
          </div>
          <Address id={o.id} kind="billing" a={o.billing} />
          <Address id={o.id} kind="shipping" a={o.shipping} />
          <table className="list">
            <thead><tr><th>品項</th><th>單價</th><th>數量</th><th>小計</th></tr></thead>
            <tbody>
              {lines.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.product_id ? <Link href={`/admin/products/${i.product_id}/`}>{i.name}</Link> : i.name}{i.sku ? <div className="muted">SKU {i.sku}</div> : null}{i.meta?.variation && Object.keys(i.meta.variation).length ? <div className="muted">{Object.entries(i.meta.variation).map(([k, v]) => `${k}: ${v}`).join("，")}</div> : null}</td>
                  <td>{money(i.unit_price)}</td><td>× {i.quantity}</td><td>{money(i.total)}</td>
                </tr>
              ))}
              {others.map((i: any) => <tr key={i.id}><td colSpan={3} className="muted">{({ shipping: "運費", fee: "費用", coupon: "優惠券", tax: "稅" } as Record<string, string>)[i.item_type] || i.item_type}：{i.name}</td><td>{money(i.total)}</td></tr>)}
              <tr><td colSpan={3} style={{ textAlign: "right" }}>折扣</td><td>{money(o.discount_total)}</td></tr>
              <tr><td colSpan={3} style={{ textAlign: "right" }}>運費</td><td>{money(o.shipping_total)}</td></tr>
              <tr><td colSpan={3} style={{ textAlign: "right" }}><strong>訂單總計</strong></td><td><strong>{money(o.total)}</strong> <span className="muted">{o.currency}</span></td></tr>
            </tbody>
          </table>
          {o.refunds.length ? <div className="card" style={{ marginTop: 12 }}><h2>退款</h2>{o.refunds.map((r: any) => <p key={r.id}>{fmtDate(r.created_at)} {money(r.amount)} {r.reason}</p>)}</div> : null}
        </div>
        <div>
          <form action={orderStatusAction} className="card">
            <h2>訂單狀態</h2>
            <input type="hidden" name="id" value={o.id} />
            <select name="status" defaultValue={o.status}>{Object.entries(ORDER_STATUSES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <label>附註（選填，記入訂單備註）</label><textarea name="note" rows={2} />
            <p className="muted">轉為「處理中／已完成／保留」會扣除有管理庫存的商品數量；取消、退款、失敗會回補。</p>
            <div className="actions"><button className="btn btn-p">更新訂單</button></div>
          </form>
          <div className="card">
            <h2>訂單備註</h2>
            <form action={orderNoteAction}>
              <input type="hidden" name="id" value={o.id} />
              <textarea name="content" rows={2} required />
              <label className="inline"><input type="checkbox" name="customer_note" /> 給顧客的備註</label>
              <div className="actions"><button className="btn">新增備註</button></div>
            </form>
            {o.notes.map((n: any) => <div key={n.id} style={{ background: n.is_customer_note ? "#a7cedc33" : "#f0f0f1", padding: 8, margin: "8px 0" }}><div>{n.content}</div><div className="muted">{fmtDate(n.created_at)} · {n.added_by || "system"}</div></div>)}
          </div>
        </div>
      </div>
    </>
  );
}
