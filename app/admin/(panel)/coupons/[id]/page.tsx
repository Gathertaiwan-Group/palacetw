import SubmitButton from "@/components/admin/SubmitButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoupon } from "@/lib/admin/commerce";
import { listTerms } from "@/lib/admin/terms";
import { couponAction, deleteCouponAction } from "../../../actions";
import { Notice, type SP } from "@/components/admin/ui";

export const metadata = { title: "優惠券" };

function CatSel({ name, sel, cats }: { name: string; sel: number[]; cats: any[] }) {
  return <div className="checklist">{cats.map((t: any) => <label key={t.id}><input type="checkbox" name={name} value={t.id} defaultChecked={sel.includes(t.id)} /> {t.name}</label>)}</div>;
}

export default async function Coupon({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const isNew = id === "new";
  const c = isNew ? null : await getCoupon(Number(id)).catch(() => null);
  if (!isNew && !c) notFound();
  const cats = await listTerms("product_cat");
  const exp = c?.date_expires ? new Date(new Date(c.date_expires).getTime() + 8 * 3600e3).toISOString().slice(0, 10) : "";
  return (
    <>
      <h1>{isNew ? "新增優惠券" : `優惠券 ${c.code}`} <Link className="btn" href="/admin/coupons/">← 優惠券列表</Link></h1>
      <Notice sp={sp} />
      <form action={couponAction} className="card">
        {c ? <input type="hidden" name="id" value={c.id} /> : null}
        <div className="cols">
          <div><label>優惠碼</label><input type="text" name="code" defaultValue={c?.code || ""} required /></div>
          <div><label>折扣類型</label><select name="discount_type" defaultValue={c?.discount_type || "fixed_cart"}><option value="percent">百分比折扣</option><option value="fixed_cart">購物車固定折扣</option><option value="fixed_product">商品固定折扣</option></select></div>
          <div><label>折扣金額／百分比</label><input type="number" step="0.01" min="0" name="amount" defaultValue={c?.amount ?? 0} /></div>
          <div><label>到期日</label><input type="date" name="date_expires" defaultValue={exp} /></div>
          <div><label>狀態</label><select name="status" defaultValue={c?.status || "publish"}><option value="publish">啟用</option><option value="draft">停用（草稿）</option></select></div>
        </div>
        <label>說明</label><input type="text" name="description" defaultValue={c?.description || ""} />
        <div style={{ marginTop: 8 }}>
          <label className="inline"><input type="checkbox" name="free_shipping" defaultChecked={!!c?.free_shipping} /> 免運費</label>
          <label className="inline"><input type="checkbox" name="individual_use" defaultChecked={!!c?.individual_use} /> 不可與其他優惠券併用</label>
          <label className="inline"><input type="checkbox" name="exclude_sale_items" defaultChecked={!!c?.exclude_sale_items} /> 排除特價商品</label>
        </div>
        <h2 style={{ marginTop: 16 }}>使用限制</h2>
        <div className="cols">
          <div><label>最低消費</label><input type="number" step="0.01" name="minimum_amount" defaultValue={c?.minimum_amount ?? ""} /></div>
          <div><label>最高消費</label><input type="number" step="0.01" name="maximum_amount" defaultValue={c?.maximum_amount ?? ""} /></div>
          <div><label>總使用次數上限</label><input type="number" name="usage_limit" defaultValue={c?.usage_limit ?? ""} /></div>
          <div><label>每位顧客使用上限</label><input type="number" name="usage_limit_per_user" defaultValue={c?.usage_limit_per_user ?? ""} /></div>
          <div><label>最多套用商品件數</label><input type="number" name="limit_usage_to_x_items" defaultValue={c?.limit_usage_to_x_items ?? ""} /></div>
        </div>
        <div className="cols">
          <div><label>限定商品 ID</label><p className="muted">{(c?.product_ids || []).join(", ") || "（不限）"}；指定商品可透過 MCP 的 save_coupon 設定。</p></div>
          <div><label>允許的 Email（逗號分隔）</label><input type="text" name="email_restrictions" defaultValue={(c?.email_restrictions || []).join(", ")} /></div>
        </div>
        <div className="cols">
          <div><label>限定商品分類</label><CatSel name="product_categories" sel={c?.product_categories || []} cats={cats} /></div>
          <div><label>排除商品分類</label><CatSel name="excluded_product_categories" sel={c?.excluded_product_categories || []} cats={cats} /></div>
        </div>
        {(c?.product_ids || []).map((pid: number) => <input key={pid} type="hidden" name="product_ids" value={pid} />)}
        {(c?.excluded_product_ids || []).map((pid: number) => <input key={pid} type="hidden" name="excluded_product_ids" value={pid} />)}
        <div className="actions">
          <SubmitButton className="btn btn-p" name="_submit" value="save">{isNew ? "建立優惠券" : "更新優惠券"}</SubmitButton>
          {c ? <SubmitButton className="btn btn-d" formAction={deleteCouponAction} name="_submit" value="delete" pendingText="刪除中…">刪除</SubmitButton> : null}
        </div>
        {c ? <p className="muted">已使用 {c.usage_count} 次{c.used_by?.length ? `：${c.used_by.join(", ")}` : ""}</p> : null}
      </form>
    </>
  );
}
