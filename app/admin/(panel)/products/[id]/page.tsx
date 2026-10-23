import { notFound } from "next/navigation";
import PostEditor from "@/components/admin/PostEditor";
import ProductData from "@/components/admin/ProductData";
import { Badge, Notice, money, type SP } from "@/components/admin/ui";
import { getProduct } from "@/lib/admin/products";
import { sb } from "@/lib/admin/core";
import { editorData } from "../../posts/editor-data";
import { saveVariationAction, deleteVariationAction, saveAttributesAction } from "../../../actions";

export const metadata = { title: "編輯商品" };

function VariationForm({ pid, v }: { pid: number; v: any | null }) {
  const attrs = v ? Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join("\n") : "";
  return (
    <form action={saveVariationAction} className="card" style={{ marginBottom: 8 }}>
      <input type="hidden" name="product_id" value={pid} />
      {v ? <input type="hidden" name="variation_id" value={v.id} /> : null}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{v ? <>變體 #{v.id} <Badge s={v.stock_status} /> {money(v.price)}</> : "新增變體"}</strong>
      </div>
      <div className="cols">
        <div><label>屬性（每行「名稱: 值」）</label><textarea name="attributes" rows={2} defaultValue={attrs} placeholder={"容量: 600ml"} style={{ minHeight: 50 }} /></div>
        <div><label>SKU</label><input type="text" name="sku" defaultValue={v?.sku || ""} /></div>
        <div><label>原價</label><input type="number" step="0.01" name="regular_price" defaultValue={v?.regular_price ?? ""} /></div>
        <div><label>特價</label><input type="number" step="0.01" name="sale_price" defaultValue={v?.sale_price ?? ""} /></div>
        <div><label className="inline" style={{ marginTop: 28 }}><input type="checkbox" name="manage_stock" defaultChecked={!!v?.manage_stock} /> 管理庫存</label></div>
        <div><label>庫存數量</label><input type="number" name="stock_quantity" defaultValue={v?.stock_quantity ?? ""} /></div>
        <div><label>庫存狀態</label><select name="stock_status" defaultValue={v?.stock_status || "instock"}><option value="instock">有庫存</option><option value="outofstock">缺貨</option><option value="onbackorder">預購</option></select></div>
        <div><label>狀態</label><select name="status" defaultValue={v?.status || "publish"}><option value="publish">啟用</option><option value="private">停用</option></select></div>
        <div><label>圖片媒體 ID</label><input type="number" name="image_id" defaultValue={v?.image_id ?? ""} /></div>
      </div>
      <label>說明</label><input type="text" name="description" defaultValue={v?.description || ""} />
      <div className="actions">
        <button className="btn btn-p">{v ? "儲存變體" : "新增變體"}</button>
        {v ? <button className="btn btn-d" formAction={deleteVariationAction}>刪除變體</button> : null}
      </div>
    </form>
  );
}

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getProduct(Number(id)).catch(() => null);
  if (!p) notFound();
  const d = await editorData("product", p.featured_media_id);
  const gids: number[] = p.product?.gallery_image_ids || [];
  const { data: gm } = gids.length ? await sb().from("media").select("id,public_url").in("id", gids) : { data: [] };
  const gallery = gids.map((g) => ({ id: g, url: (gm || []).find((m: any) => m.id === g)?.public_url || "" })).filter((g) => g.url);
  const attrText = (p.attributes as any[]).map((a) => `${a.name}: ${(a.options || []).join(" | ")}`).join("\n");
  return (
    <>
      <h1>編輯商品</h1>
      <Notice sp={sp} />
      <PostEditor key={`${p.id}-${p.modified_at}`} post={p} type="product" typeLabel="商品" cats={d.cats} tags={d.tags} catLabel="商品分類" tagLabel="商品標籤" featuredUrl={d.featuredUrl} listHref="/admin/products/">
        <ProductData p={p.product} gallery={gallery} />
      </PostEditor>
      <div id="variations" style={{ marginTop: 24 }}>
        <h1>屬性與變體 {p.product?.product_type !== "variable" ? <span className="muted" style={{ fontSize: 13 }}>（商品類型設為「可變商品」後，前台才會顯示變體選項）</span> : null}</h1>
        <form action={saveAttributesAction} className="card">
          <input type="hidden" name="product_id" value={p.id} />
          <label>屬性（每行「屬性名稱: 選項1 | 選項2」）</label>
          <textarea name="attributes" rows={3} defaultValue={attrText} placeholder={"容量: 300ml | 600ml"} />
          <div className="actions"><button className="btn">儲存屬性</button></div>
        </form>
        {(p.variations as any[]).map((v) => <VariationForm key={`${v.id}-${v.updated_at}`} pid={p.id} v={v} />)}
        <VariationForm pid={p.id} v={null} />
      </div>
    </>
  );
}
