import Link from "next/link";
import { notFound } from "next/navigation";
import { getMenu, getSettings } from "@/lib/admin/site";
import { sb } from "@/lib/admin/core";
import { menuAction, deleteMenuAction } from "../../../actions";
import MenuEditor from "@/components/admin/MenuEditor";
import { Notice, type SP } from "@/components/admin/ui";

export const metadata = { title: "編輯選單" };

export default async function MenuEdit({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const m = await getMenu(Number(id)).catch(() => null);
  if (!m) notFound();
  const [settings, { data: pages }, { data: terms }] = await Promise.all([
    getSettings(true),
    sb().from("posts").select("title,path").in("post_type", ["page", "post"]).eq("status", "publish").not("path", "is", null).order("title"),
    sb().from("terms").select("name,slug,taxonomy").in("taxonomy", ["category", "product_cat"]).order("name"),
  ]);
  const links = [
    ...(pages || []).map((p: any) => ({ title: p.title, path: p.path })),
    ...(terms || []).map((t: any) => ({ title: `${t.taxonomy === "category" ? "分類" : "商品分類"}：${t.name}`, path: `/${t.taxonomy === "category" ? "category" : "product-category"}/${t.slug}/` })),
  ];
  return (
    <>
      <h1>編輯選單 <Link className="btn" href="/admin/menus/">← 所有選單</Link></h1>
      <Notice sp={sp} />
      <form action={menuAction} className="card">
        <input type="hidden" name="id" value={m.id} />
        <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}><label>選單名稱</label><input type="text" name="name" defaultValue={m.name} required /></div>
          <label className="inline"><input type="checkbox" name="primary" defaultChecked={settings.primary_menu?.menu_id === m.id} /> 主選單（頁首）</label>
        </div>
        <h2 style={{ marginTop: 16 }}>選單項目</h2>
        <MenuEditor key={JSON.stringify(m.items.map((i: any) => i.id))} initial={m.items} pages={links} />
        <div className="actions">
          <button className="btn btn-p">儲存選單</button>
          <button className="btn btn-d" formAction={deleteMenuAction}>刪除選單</button>
        </div>
      </form>
    </>
  );
}
