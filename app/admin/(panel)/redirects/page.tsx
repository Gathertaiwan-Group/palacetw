import { listRedirects } from "@/lib/admin/site";
import { redirectAction, deleteRedirectAction } from "../../actions";
import { Notice, Pager, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "轉址管理" };

export default async function Redirects({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { limit, offset } = pageOf(sp, 100);
  const res = await listRedirects({ search: one(sp.s), kind: one(sp.kind) || undefined, limit, offset });
  const self = `/admin/redirects/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  return (
    <>
      <h1>轉址管理</h1>
      <p className="muted">來源路徑在新站找不到內容時，依此表轉址（舊附件頁與 /wp-content/uploads/ 檔案由 proxy 處理）。修改文章／分類代稱時會自動新增 301。</p>
      <Notice sp={sp} />
      <form action={redirectAction} className="card filters" style={{ alignItems: "end" }}>
        <input type="hidden" name="_back" value={self} />
        <div style={{ flex: 2, minWidth: 200 }}><label>來源路徑</label><input type="text" name="source_path" placeholder="/old-page/" required /></div>
        <div style={{ flex: 2, minWidth: 200 }}><label>目標</label><input type="text" name="target" placeholder="/new-page/ 或 https://…" /></div>
        <div><label>狀態碼</label><select name="status_code" defaultValue="301"><option>301</option><option>302</option><option>307</option><option>308</option><option>410</option></select></div>
        <button className="btn btn-p">新增轉址</button>
      </form>
      <form className="filters" method="get" action="/admin/redirects/">
        <select name="kind" defaultValue={one(sp.kind)}><option value="">所有類型</option><option value="manual">手動</option><option value="slug-change">代稱變更</option><option value="attachment">附件頁</option><option value="upload">上傳檔案</option></select>
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="搜尋路徑" />
        <button className="btn">篩選</button>
      </form>
      <Pager base="/admin/redirects/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <table className="list">
        <thead><tr><th>來源 → 目標</th><th style={{ width: 80 }}>類型</th><th style={{ width: 60 }}>命中</th><th style={{ width: 120 }}></th></tr></thead>
        <tbody>
          {res.items.map((r: any) => (
            <tr key={r.id}>
              <td>
                <form action={redirectAction} id={`r${r.id}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 6 }}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={self} />
                  <input type="text" name="source_path" defaultValue={r.source_path} aria-label="來源" />
                  <input type="text" name="target" defaultValue={r.target} aria-label="目標" />
                  <select name="status_code" defaultValue={String(r.status_code)} aria-label="狀態碼"><option>301</option><option>302</option><option>307</option><option>308</option><option>410</option></select>
                </form>
              </td>
              <td className="muted">{r.kind}</td><td>{r.hits}</td>
              <td><button className="btn btn-s" form={`r${r.id}`}>儲存</button> <form action={deleteRedirectAction} style={{ display: "inline" }}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="_back" value={self} /><button className="btn btn-s btn-d">刪除</button></form></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
