import Link from "next/link";
import { listProducts } from "@/lib/admin/products";
import { listTerms } from "@/lib/admin/terms";
import { statusCounts } from "@/lib/admin/posts";
import { sb } from "@/lib/admin/core";
import { trashPostAction, restorePostAction, deletePostAction, quickPriceStockAction } from "../../actions";
import { Badge, Notice, Pager, money, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "商品" };

export default async function ProductsList({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = one(sp.status) || "any";
  const cat = Number(one(sp.cat)) || undefined;
  const { limit, offset } = pageOf(sp, 30);
  const [res, counts, cats] = await Promise.all([
    listProducts({ status, search: one(sp.s), category_id: cat, stock_status: one(sp.stock) || undefined, limit, offset }),
    statusCounts("product"),
    listTerms("product_cat"),
  ]);
  const mids = res.items.map((p: any) => p.featured_media_id).filter(Boolean);
  const { data: thumbs } = mids.length ? await sb().from("media").select("id,public_url").in("id", mids) : { data: [] };
  const thumb = (id: number | null) => (thumbs || []).find((t: any) => t.id === id)?.public_url;
  const self = `/admin/products/?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => !["msg", "err"].includes(k) && one(v)).map(([k, v]) => [k, one(v)])).toString()}`;
  const all = Object.entries(counts).filter(([k]) => k !== "trash").reduce((a, [, n]) => a + n, 0);
  const tab = (st: string, label: string, n: number) => <li key={st}>{status === st ? <span className="cur">{label}</span> : <Link href={`/admin/products/${st === "any" ? "" : `?status=${st}`}`}>{label}</Link>} <span className="muted">({n})</span></li>;
  return (
    <>
      <h1>商品 <Link className="btn" href="/admin/products/new/">新增商品</Link></h1>
      <Notice sp={sp} />
      <ul className="subsubsub">
        {tab("any", "全部", all)}{tab("publish", "已發布", counts.publish)}{tab("draft", "草稿", counts.draft)}{tab("future", "排程", counts.future)}{tab("private", "私密", counts.private)}{tab("trash", "回收桶", counts.trash)}
      </ul>
      <form className="filters" method="get" action="/admin/products/">
        {status !== "any" ? <input type="hidden" name="status" value={status} /> : null}
        <select name="cat" defaultValue={cat || ""}><option value="">所有分類</option>{cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="stock" defaultValue={one(sp.stock)}><option value="">所有庫存狀態</option><option value="instock">有庫存</option><option value="outofstock">缺貨</option><option value="onbackorder">預購</option></select>
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="搜尋商品" />
        <button className="btn" type="submit">篩選</button>
      </form>
      <Pager base="/admin/products/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <table className="list">
        <thead><tr><th style={{ width: 56 }}></th><th>名稱</th><th>SKU</th><th>價格／庫存（快速編輯）</th><th>狀態</th></tr></thead>
        <tbody>
          {res.items.length ? res.items.map((p: any) => {
            const pr = Array.isArray(p.products) ? p.products[0] : p.products;
            return (
              <tr key={p.id}>
                <td>{thumb(p.featured_media_id) ? <img className="thumb" src={thumb(p.featured_media_id)} alt="" /> : <span className="thumb" style={{ display: "inline-block" }} />}</td>
                <td>
                  <strong><Link href={`/admin/products/${p.id}/`}>{p.title || "（無標題）"}</Link></strong>{pr?.featured ? " ★" : ""}
                  <div className="row-actions">
                    <span className="muted">ID {p.id} · {pr?.product_type}</span>{" "}
                    {p.status === "trash" ? (
                      <>
                        <form action={restorePostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn">還原</button></form>{" "}
                        <form action={deletePostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn del">永久刪除</button></form>
                      </>
                    ) : (
                      <>
                        <Link href={`/admin/products/${p.id}/`}>編輯</Link>
                        {p.status === "publish" && p.path ? <a href={p.path} target="_blank" rel="noreferrer">檢視</a> : <Link href={`/admin/preview/${p.id}/`} target="_blank">預覽</Link>}
                        <form action={trashPostAction} style={{ display: "inline" }}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="_back" value={self} /><button className="linkbtn del">移到回收桶</button></form>
                      </>
                    )}
                  </div>
                </td>
                <td className="muted">{pr?.sku || "—"}</td>
                <td>
                  {pr?.product_type === "variable" ? <span className="muted">可變商品：{money(pr?.price)} 起（於編輯頁調整變體）</span> : (
                    <form action={quickPriceStockAction} style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <input type="hidden" name="product_id" value={p.id} /><input type="hidden" name="_back" value={self} />
                      <input type="number" step="0.01" name="regular_price" defaultValue={pr?.regular_price ?? ""} placeholder="原價" style={{ width: 90 }} aria-label="原價" />
                      <input type="number" step="0.01" name="sale_price" defaultValue={pr?.sale_price ?? ""} placeholder="特價" style={{ width: 90 }} aria-label="特價" />
                      <input type="number" name="stock_quantity" defaultValue={pr?.manage_stock ? pr?.stock_quantity ?? "" : ""} placeholder="庫存數" style={{ width: 80 }} aria-label="庫存數量" />
                      <select name="stock_status" defaultValue={pr?.stock_status} style={{ width: 92 }} aria-label="庫存狀態"><option value="instock">有庫存</option><option value="outofstock">缺貨</option><option value="onbackorder">預購</option></select>
                      <button className="btn btn-s">儲存</button>
                    </form>
                  )}
                </td>
                <td><Badge s={p.status} /> <Badge s={pr?.stock_status || "instock"} /></td>
              </tr>
            );
          }) : <tr><td colSpan={5} className="muted">找不到商品。</td></tr>}
        </tbody>
      </table>
    </>
  );
}
