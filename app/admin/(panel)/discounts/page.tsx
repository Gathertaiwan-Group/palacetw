import { listRules } from "@/lib/admin/commerce";
import { listTerms } from "@/lib/admin/terms";
import { ruleAction, deleteRuleAction } from "../../actions";
import { Notice, toLocalInput, type SP } from "@/components/admin/ui";

export const metadata = { title: "數量折扣" };

function RuleForm({ r, cats }: { r: any | null; cats: any[] }) {
  return (
    <form action={ruleAction} className="card">
      {r ? <input type="hidden" name="id" value={r.id} /> : <h2>新增規則</h2>}
      <div className="cols">
        <div><label>名稱</label><input type="text" name="name" defaultValue={r?.name || ""} required /></div>
        <div><label>適用範圍</label><select name="scope" defaultValue={r?.scope || "product"}><option value="all">全部商品</option><option value="product">指定商品</option><option value="variation">指定變體</option><option value="product_cat">指定商品分類</option></select></div>
        <div><label>商品 ID</label><input type="number" name="product_id" defaultValue={r?.product_id ?? ""} /></div>
        <div><label>變體 ID</label><input type="number" name="variation_id" defaultValue={r?.variation_id ?? ""} /></div>
        <div><label>商品分類</label><select name="term_id" defaultValue={r?.term_id ?? ""}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label>最少數量</label><input type="number" min="1" name="min_qty" defaultValue={r?.min_qty ?? 2} /></div>
        <div><label>最多數量</label><input type="number" name="max_qty" defaultValue={r?.max_qty ?? ""} /></div>
        <div><label>折扣方式</label><select name="discount_type" defaultValue={r?.discount_type || "percent"}><option value="percent">折扣百分比</option><option value="fixed_amount">每件折抵金額</option><option value="fixed_price">固定單價</option></select></div>
        <div><label>數值</label><input type="number" step="0.01" name="amount" defaultValue={r?.amount ?? ""} required /></div>
        <div><label>優先順序（小者優先）</label><input type="number" name="priority" defaultValue={r?.priority ?? 10} /></div>
        <div><label>開始</label><input type="datetime-local" name="starts_at" defaultValue={toLocalInput(r?.starts_at)} /></div>
        <div><label>結束</label><input type="datetime-local" name="ends_at" defaultValue={toLocalInput(r?.ends_at)} /></div>
      </div>
      <label className="inline"><input type="checkbox" name="active" defaultChecked={r ? r.active : true} /> 啟用</label>
      <div className="actions">
        <button className="btn btn-p">{r ? "儲存" : "新增規則"}</button>
        {r ? <button className="btn btn-d" formAction={deleteRuleAction}>刪除</button> : null}
      </div>
    </form>
  );
}

export default async function Discounts({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [rules, cats] = await Promise.all([listRules(), listTerms("product_cat")]);
  return (
    <>
      <h1>數量折扣規則</h1>
      <p className="muted">買越多越便宜：商品頁會顯示折扣表，購物車與結帳自動套用。</p>
      <Notice sp={sp} />
      {rules.map((r) => <RuleForm key={`${r.id}`} r={r} cats={cats} />)}
      <RuleForm r={null} cats={cats} />
    </>
  );
}
