import { listAudit } from "@/lib/admin/site";
import { Notice, Pager, fmtDate, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "稽核紀錄" };

export default async function Audit({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { limit, offset } = pageOf(sp, 50);
  const res = await listAudit({ actor_type: one(sp.actor) || undefined, entity_type: one(sp.entity) || undefined, search: one(sp.s), limit, offset });
  return (
    <>
      <h1>稽核紀錄</h1>
      <Notice sp={sp} />
      <form className="filters" method="get" action="/admin/audit/">
        <select name="actor" defaultValue={one(sp.actor)}><option value="">所有來源</option><option value="admin">後台</option><option value="mcp">MCP</option><option value="system">系統</option></select>
        <input type="text" name="entity" defaultValue={one(sp.entity)} placeholder="類型（post、product、order…）" style={{ width: 200 }} />
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="動作、操作者或 ID" />
        <button className="btn">篩選</button>
      </form>
      <Pager base="/admin/audit/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <table className="list">
        <thead><tr><th style={{ width: 150 }}>時間</th><th>操作者</th><th>動作</th><th>對象</th><th>變更</th></tr></thead>
        <tbody>
          {res.items.map((a: any) => (
            <tr key={a.id}>
              <td className="muted">{fmtDate(a.created_at)}</td>
              <td>{a.actor} <span className="muted">（{a.actor_type}{a.ip ? ` · ${a.ip}` : ""}）</span></td>
              <td><code>{a.action}</code></td>
              <td>{a.entity_type}{a.entity_id ? ` #${a.entity_id}` : ""}</td>
              <td>{a.before || a.after ? <details><summary className="muted">檢視</summary>{a.before ? <><div className="muted">之前</div><pre className="json">{JSON.stringify(a.before, null, 1)}</pre></> : null}{a.after ? <><div className="muted">之後</div><pre className="json">{JSON.stringify(a.after, null, 1)}</pre></> : null}</details> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
