import Link from "next/link";
import { listMenus, getSettings } from "@/lib/admin/site";
import { menuAction } from "../../actions";
import { Notice, type SP } from "@/components/admin/ui";

export const metadata = { title: "選單" };

export default async function Menus({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [menus, settings] = await Promise.all([listMenus(), getSettings(true)]);
  const primary = settings.primary_menu?.menu_id;
  return (
    <>
      <h1>選單</h1>
      <Notice sp={sp} />
      <table className="list" style={{ marginBottom: 16 }}>
        <thead><tr><th>選單</th><th>項目數</th><th>位置</th></tr></thead>
        <tbody>{menus.map((m) => <tr key={m.id}><td><Link href={`/admin/menus/${m.id}/`}><strong>{m.name}</strong></Link></td><td>{m.item_count}</td><td>{m.id === primary ? "主選單（頁首）" : "—"}</td></tr>)}</tbody>
      </table>
      <form action={menuAction} className="card" style={{ maxWidth: 420 }}>
        <h2>建立新選單</h2>
        <label>選單名稱</label><input type="text" name="name" required />
        <label className="inline"><input type="checkbox" name="primary" /> 設為主選單（頁首）</label>
        <div className="actions"><button className="btn btn-p">建立選單</button></div>
      </form>
    </>
  );
}
