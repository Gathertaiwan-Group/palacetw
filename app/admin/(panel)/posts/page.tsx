import Link from "next/link";
import { listPosts, statusCounts, POST_TYPES } from "@/lib/admin/posts";
import { listTerms } from "@/lib/admin/terms";
import { trashPostAction, restorePostAction, deletePostAction } from "../../actions";
import { Badge, Notice, Pager, fmtDate, one, pageOf, type SP } from "@/components/admin/ui";

const TYPE_LABEL: Record<string, string> = { post: "文章", page: "頁面", ocean_modal_window: "彈出視窗" };
export const metadata = { title: "內容" };

export default async function PostsList({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const type = POST_TYPES.includes(one(sp.type) as any) && one(sp.type) !== "product" ? one(sp.type) : "post";
  const status = one(sp.status) || "any";
  const cat = Number(one(sp.cat)) || undefined;
  const { limit, offset } = pageOf(sp, 30);
  const [res, counts, cats] = await Promise.all([
    listPosts({ type, status, search: one(sp.s), category_id: cat, limit, offset }),
    statusCounts(type),
    type === "post" ? listTerms("category") : Promise.resolve([]),
  ]);
  const self = `/admin/posts/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  const all = Object.entries(counts).filter(([k]) => k !== "trash").reduce((a, [, n]) => a + n, 0);
  const tab = (st: string, label: string, n: number) => (
    <li key={st}>{status === st ? <span className="cur">{label} ({n})</span> : <Link href={`/admin/posts/?type=${type}${st === "any" ? "" : `&status=${st}`}`}>{label}</Link>} <span className="muted">({n})</span></li>
  );
  return (
    <>
      <h1>{TYPE_LABEL[type]} <Link className="btn" href={`/admin/posts/new/?type=${type}`}>新增{TYPE_LABEL[type]}</Link></h1>
      <Notice sp={sp} />
      <ul className="subsubsub">
        {tab("any", "全部", all)}
        {tab("publish", "已發布", counts.publish)}
        {tab("draft", "草稿", counts.draft)}
        {tab("future", "排程", counts.future)}
        {tab("pending", "待審", counts.pending)}
        {tab("private", "私密", counts.private)}
        {tab("trash", "回收桶", counts.trash)}
      </ul>
      <form className="filters" method="get" action="/admin/posts/">
        <input type="hidden" name="type" value={type} />
        {status !== "any" ? <input type="hidden" name="status" value={status} /> : null}
        {type === "post" ? (
          <select name="cat" defaultValue={cat || ""}>
            <option value="">所有分類</option>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : null}
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder={`搜尋${TYPE_LABEL[type]}`} />
        <button className="btn" type="submit">篩選</button>
      </form>
      <Pager base="/admin/posts/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <table className="list">
        <thead><tr><th>標題</th><th>狀態</th><th>網址</th><th>日期</th></tr></thead>
        <tbody>
          {res.items.length ? res.items.map((p: any) => (
            <tr key={p.id}>
              <td>
                <strong><Link href={`/admin/posts/${p.id}/`}>{p.title || "（無標題）"}</Link></strong>
                <div className="row-actions">
                  <span className="muted">ID {p.id}</span>{" "}
                  {p.status === "trash" ? (
                    <>
                      <form action={restorePostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn">還原</button></form>{" "}
                      <form action={deletePostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn del">永久刪除</button></form>
                    </>
                  ) : (
                    <>
                      <Link href={`/admin/posts/${p.id}/`}>編輯</Link>
                      <Link href={`/admin/preview/${p.id}/`} target="_blank">預覽</Link>
                      {p.status === "publish" && p.path ? <a href={p.path} target="_blank" rel="noreferrer">檢視</a> : null}
                      <form action={trashPostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn del">移到回收桶</button></form>
                    </>
                  )}
                </div>
              </td>
              <td><Badge s={p.status} /></td>
              <td className="muted">{p.path ? decodeURIComponent(p.path) : "—"}</td>
              <td className="muted">{p.status === "future" ? "排程於 " : ""}{fmtDate(p.published_at)}</td>
            </tr>
          )) : <tr><td colSpan={4} className="muted">找不到符合的項目。</td></tr>}
        </tbody>
      </table>
    </>
  );
}
