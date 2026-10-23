import Link from "next/link";
import { listForms, listSubmissions } from "@/lib/admin/site";
import { submissionStatusAction } from "../../actions";
import { Badge, Notice, Pager, fmtDate, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "表單提交" };

export default async function Forms({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const forms = await listForms();
  const formId = Number(one(sp.form)) || undefined;
  const status = one(sp.status) || "any";
  const { limit, offset } = pageOf(sp, 50);
  const res = await listSubmissions({ form_id: formId, status, search: one(sp.s), limit, offset });
  const self = `/admin/forms/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  const formName = (id: number) => forms.find((f) => f.id === id)?.title || `表單 #${id}`;
  return (
    <>
      <h1>表單提交 <a className="btn" href={`/admin/forms-export/?${new URLSearchParams({ form: formId ? String(formId) : "", status })}`}>匯出 CSV</a></h1>
      <Notice sp={sp} />
      <table className="list" style={{ marginBottom: 12 }}>
        <thead><tr><th>表單</th><th>來源</th><th>提交數</th><th>未讀</th></tr></thead>
        <tbody>{forms.map((f) => <tr key={f.id}><td><Link href={`/admin/forms/?form=${f.id}`}>{f.title}</Link></td><td className="muted">{f.source}</td><td>{f.submissions}</td><td>{f.unread}</td></tr>)}</tbody>
      </table>
      <form className="filters" method="get" action="/admin/forms/">
        <select name="form" defaultValue={formId || ""}><option value="">所有表單</option>{forms.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
        <select name="status" defaultValue={status}><option value="any">全部（不含回收桶）</option><option value="unread">未讀</option><option value="read">已讀</option><option value="spam">垃圾</option><option value="trash">回收桶</option></select>
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="搜尋內容" />
        <button className="btn">篩選</button>
      </form>
      <form action={submissionStatusAction}>
        <input type="hidden" name="_back" value={self} />
        <div className="filters">
          <select name="status" defaultValue="read"><option value="read">標為已讀</option><option value="unread">標為未讀</option><option value="spam">標為垃圾</option><option value="trash">移到回收桶</option></select>
          <button className="btn">套用到勾選項目</button>
          <Pager base="/admin/forms/" sp={sp} total={res.total} limit={limit} offset={offset} />
        </div>
        <table className="list">
          <thead><tr><th style={{ width: 28 }}></th><th>內容</th><th>表單</th><th>狀態</th><th>時間</th></tr></thead>
          <tbody>
            {res.items.length ? res.items.map((r: any) => (
              <tr key={r.id}>
                <td><input type="checkbox" name="ids" value={r.id} aria-label={`選取 ${r.id}`} /></td>
                <td>{Object.entries(r.data || {}).map(([k, v]) => <div key={k}><span className="muted">{k}：</span>{typeof v === "object" ? JSON.stringify(v) : String(v)}</div>)}{r.page_url ? <div className="muted">頁面：{r.page_url}</div> : null}</td>
                <td className="muted">{r.form_id ? formName(r.form_id) : "—"}</td>
                <td><Badge s={r.status} /></td>
                <td className="muted">{fmtDate(r.created_at)}</td>
              </tr>
            )) : <tr><td colSpan={5} className="muted">沒有提交紀錄。</td></tr>}
          </tbody>
        </table>
      </form>
    </>
  );
}
