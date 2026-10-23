import Link from "next/link";
import { listTerms, TAXONOMIES } from "@/lib/admin/terms";
import { saveTermAction, deleteTermAction } from "../../actions";
import { Notice, one, type SP } from "@/components/admin/ui";

export const metadata = { title: "分類與標籤" };

export default async function Terms({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const tax = TAXONOMIES[one(sp.taxonomy)] ? one(sp.taxonomy) : "category";
  const list = await listTerms(tax);
  const hier = tax === "category" || tax === "product_cat";
  const group = tax.startsWith("product") ? ["product_cat", "product_tag"] : ["category", "post_tag"];
  const ordered: { t: any; depth: number }[] = [];
  const walk = (parent: number | null, depth: number) => list.filter((t: any) => (t.parent_id ?? null) === parent || (parent === null && t.parent_id && !list.some((x: any) => x.id === t.parent_id))).forEach((t: any) => { if (!ordered.some((o) => o.t.id === t.id)) { ordered.push({ t, depth }); walk(t.id, depth + 1); } });
  walk(null, 0);
  const viewBase = { category: "/category/", post_tag: "/tag/", product_cat: "/product-category/", product_tag: "/product-tag/" }[tax]!;
  return (
    <>
      <h1>{TAXONOMIES[tax]}</h1>
      <ul className="subsubsub">{group.map((g) => <li key={g}>{g === tax ? <span className="cur">{TAXONOMIES[g]}</span> : <Link href={`/admin/terms/?taxonomy=${g}`}>{TAXONOMIES[g]}</Link>}</li>)}</ul>
      <Notice sp={sp} />
      <div className="grid2" style={{ gridTemplateColumns: "300px minmax(0,1fr)" }}>
        <form action={saveTermAction} className="card">
          <h2>新增{TAXONOMIES[tax]}</h2>
          <input type="hidden" name="taxonomy" value={tax} />
          <label>名稱</label><input type="text" name="name" required />
          <label>代稱</label><input type="text" name="slug" placeholder="留空自動產生" />
          {hier ? (<><label>上層</label><select name="parent_id" defaultValue=""><option value="">無</option>{list.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></>) : <input type="hidden" name="parent_id" value="" />}
          <label>說明</label><textarea name="description" rows={3} />
          <div className="actions"><button className="btn btn-p">新增</button></div>
        </form>
        <table className="list">
          <thead><tr><th>名稱／代稱／說明</th><th style={{ width: 70 }}>數量</th><th style={{ width: 150 }}></th></tr></thead>
          <tbody>
            {ordered.length ? ordered.map(({ t, depth }) => (
              <tr key={t.id}>
                <td>
                  <form action={saveTermAction} id={`t${t.id}`} style={{ display: "grid", gridTemplateColumns: hier ? "1fr 1fr 1fr" : "1fr 1fr", gap: 6, paddingLeft: depth * 18 }}>
                    <input type="hidden" name="taxonomy" value={tax} /><input type="hidden" name="id" value={t.id} />
                    <input type="text" name="name" defaultValue={t.name} aria-label="名稱" />
                    <input type="text" name="slug" defaultValue={decodeURIComponent(t.slug)} aria-label="代稱" />
                    {hier ? <select name="parent_id" defaultValue={t.parent_id ?? ""} aria-label="上層"><option value="">（無上層）</option>{list.filter((x: any) => x.id !== t.id).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <input type="hidden" name="parent_id" value="" />}
                    <input type="text" name="description" defaultValue={t.description} placeholder="說明" aria-label="說明" style={{ gridColumn: "1 / -1" }} />
                  </form>
                  <div className="row-actions"><span className="muted">ID {t.id}</span> <a href={`${viewBase}${t.slug}/`} target="_blank" rel="noreferrer">檢視</a></div>
                </td>
                <td>{t.count}</td>
                <td>
                  <button className="btn btn-s" form={`t${t.id}`}>儲存</button>{" "}
                  <form action={deleteTermAction} style={{ display: "inline" }}><input type="hidden" name="taxonomy" value={tax} /><input type="hidden" name="id" value={t.id} /><button className="btn btn-s btn-d">刪除</button></form>
                </td>
              </tr>
            )) : <tr><td colSpan={3} className="muted">尚無項目。</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
