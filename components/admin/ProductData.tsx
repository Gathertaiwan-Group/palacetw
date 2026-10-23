import { GalleryField } from "./MediaPicker";
import { toLocalInput } from "./ui";

/** WooCommerce "Product data" box — fields are part of the surrounding post editor form. */
export default function ProductData({ p, gallery }: { p: any | null; gallery: { id: number; url: string }[] }) {
  const v = (k: string) => (p?.[k] ?? "") as string | number;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>商品資料</h2>
      <div className="cols">
        <div><label>商品類型</label>
          <select name="product_type" defaultValue={p?.product_type || "simple"}>
            <option value="simple">簡單商品</option><option value="variable">可變商品</option><option value="grouped">組合商品</option><option value="external">外部／聯盟商品</option>
          </select></div>
        <div><label>SKU（貨號）</label><input type="text" name="sku" defaultValue={v("sku")} /></div>
        <div><label>原價（NT$）</label><input type="number" step="0.01" min="0" name="regular_price" defaultValue={v("regular_price")} /></div>
        <div><label>特價（NT$）</label><input type="number" step="0.01" min="0" name="sale_price" defaultValue={v("sale_price")} /></div>
        <div><label>特價開始</label><input type="datetime-local" name="sale_from" defaultValue={toLocalInput(p?.sale_from)} /></div>
        <div><label>特價結束</label><input type="datetime-local" name="sale_to" defaultValue={toLocalInput(p?.sale_to)} /></div>
      </div>
      <h2 style={{ marginTop: 16 }}>庫存</h2>
      <div className="cols">
        <div><label className="inline" style={{ marginTop: 28 }}><input type="checkbox" name="manage_stock" defaultChecked={!!p?.manage_stock} /> 管理庫存數量</label></div>
        <div><label>庫存數量</label><input type="number" name="stock_quantity" defaultValue={v("stock_quantity")} /></div>
        <div><label>庫存狀態</label>
          <select name="stock_status" defaultValue={p?.stock_status || "instock"}><option value="instock">有庫存</option><option value="outofstock">缺貨</option><option value="onbackorder">預購</option></select></div>
        <div><label>允許缺貨下單</label>
          <select name="backorders" defaultValue={p?.backorders || "no"}><option value="no">不允許</option><option value="notify">允許並通知顧客</option><option value="yes">允許</option></select></div>
        <div><label>最少購買量</label><input type="number" min="1" name="min_qty" defaultValue={p?.min_qty ?? 1} /></div>
        <div><label>最多購買量</label><input type="number" min="1" name="max_qty" defaultValue={v("max_qty")} /></div>
        <div><label>數量級距</label><input type="number" min="1" name="qty_step" defaultValue={p?.qty_step ?? 1} /></div>
        <div><label>重量（kg）</label><input type="number" step="0.001" name="weight" defaultValue={v("weight")} /></div>
      </div>
      <h2 style={{ marginTop: 16 }}>顯示</h2>
      <div className="cols">
        <div><label>商品目錄可見度</label>
          <select name="catalog_visibility" defaultValue={p?.catalog_visibility || "visible"}><option value="visible">商店與搜尋結果</option><option value="catalog">只在商店</option><option value="search">只在搜尋結果</option><option value="hidden">隱藏</option></select></div>
        <div><label className="inline" style={{ marginTop: 28 }}><input type="checkbox" name="featured" defaultChecked={!!p?.featured} /> 精選商品</label></div>
      </div>
      <label>商品圖庫</label>
      <GalleryField name="gallery_image_ids" initial={gallery} />
      <label>商品簡短說明（HTML）</label>
      <textarea name="short_description" rows={4} defaultValue={p?.short_description || ""} />
      <label>購買備註（訂單完成後顯示給顧客）</label>
      <textarea name="purchase_note" rows={2} defaultValue={p?.purchase_note || ""} />
    </div>
  );
}
