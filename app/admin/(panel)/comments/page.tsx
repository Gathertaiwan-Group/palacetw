import Link from "next/link";
import { listComments } from "@/lib/admin/site";
import { commentStatusAction } from "../../actions";
import { Badge, Notice, Pager, fmtDate, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "留言" };

export default async function Comments({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = one(sp.status) || "any";
  const { limit, offset } = pageOf(sp, 50);
  const res = await listComments({ status, limit, offset });
  const self = `/admin/comments/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  return (
    <>
      <h1>留言</h1>
      <Notice sp={sp} />
      <ul className="subsubsub">
        {[["any", "全部"], ["hold", "待審核"], ["approved", "已核准"], ["spam", "垃圾"], ["trash", "回收桶"]].map(([k, l]) => <li key={k}>{status === k ? <span className="cur">{l}</span> : <Link href={`/admin/comments/${k === "any" ? "" : `?status=${k}`}`}>{l}</Link>}</li>)}
      </ul>
      <form action={commentStatusAction}>
        <input type="hidden" name="_back" value={self} />
        <div className="filters">
          <select name="status" defaultValue="approved"><option value="approved">核准</option><option value="hold">駁回（待審核）</option><option value="spam">標為垃圾</option><option value="trash">移到回收桶</option><option value="delete">永久刪除</option></select>
          <button className="btn">套用到勾選項目</button>
          <Pager base="/admin/comments/" sp={sp} total={res.total} limit={limit} offset={offset} />
        </div>
        <table className="list">
          <thead><tr><th style={{ width: 28 }}></th><th>作者</th><th>留言</th><th>回應至</th><th>狀態</th><th>時間</th></tr></thead>
          <tbody>
            {res.items.length ? res.items.map((c: any) => {
              const priv = Array.isArray(c.comment_private) ? c.comment_private[0] : c.comment_private;
              const post = Array.isArray(c.posts) ? c.posts[0] : c.posts;
              return (
                <tr key={c.id}>
                  <td><input type="checkbox" name="ids" value={c.id} aria-label={`選取留言 ${c.id}`} /></td>
                  <td><strong>{c.author_name}</strong><div className="muted">{priv?.author_email}{priv?.author_ip ? ` · ${priv.author_ip}` : ""}</div></td>
                  <td><div style={{ whiteSpace: "pre-wrap" }}>{String(c.content).replace(/<[^>]+>/g, "")}</div>{c.rating ? <div className="muted">評分 {c.rating}</div> : null}</td>
                  <td>{post ? <a href={post.path || "#"} target="_blank" rel="noreferrer">{post.title}</a> : "—"}</td>
                  <td><Badge s={c.status} /></td>
                  <td className="muted">{fmtDate(c.created_at)}</td>
                </tr>
              );
            }) : <tr><td colSpan={6} className="muted">沒有留言。</td></tr>}
          </tbody>
        </table>
      </form>
    </>
  );
}
