import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AdminError, type Actor } from "@/lib/admin/core";
import * as posts from "@/lib/admin/posts";
import * as products from "@/lib/admin/products";
import * as terms from "@/lib/admin/terms";
import * as media from "@/lib/admin/media";
import * as commerce from "@/lib/admin/commerce";
import * as site from "@/lib/admin/site";
import { SITE_URL } from "@/lib/site";

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });
const fail = (e: unknown) => {
  const msg = e instanceof AdminError ? e.message : `內部錯誤：${(e as Error)?.message ?? e}`;
  if (!(e instanceof AdminError)) console.error("[mcp]", e);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
};
function h<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try { return ok(await fn(args)); } catch (e) { return fail(e); }
  };
}

const RO = { readOnlyHint: true, openWorldHint: false } as const;
const WR = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DEL = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

const id = z.number().int().positive();
const page = { limit: z.number().int().min(1).max(500).optional().describe("每頁筆數，預設 50"), offset: z.number().int().min(0).optional() };
const statusEnum = z.enum(["draft", "pending", "publish", "future", "private"]);
const postFields = {
  title: z.string().optional().describe("標題"),
  slug: z.string().optional().describe("網址代稱（留空依標題產生，中文可）"),
  content: z.string().optional().describe("內文 HTML"),
  excerpt: z.string().optional().describe("摘要"),
  status: statusEnum.optional().describe("狀態；新增預設 draft。future = 排程（需 date）"),
  date: z.string().nullable().optional().describe("發布時間 ISO 8601（含時區），未來時間 + publish = 排程"),
  author_id: z.number().int().nullable().optional(),
  parent_id: z.number().int().nullable().optional().describe("上層頁面 ID（頁面）"),
  menu_order: z.number().int().optional(),
  comment_status: z.enum(["open", "closed"]).optional(),
  featured_media_id: z.number().int().nullable().optional().describe("精選圖片的媒體 ID"),
  category_ids: z.array(z.number().int()).optional().describe("分類 ID（文章=category，商品=product_cat）；給了就整組取代"),
  tag_ids: z.array(z.number().int()).optional().describe("標籤 ID（文章=post_tag，商品=product_tag）；給了就整組取代"),
  seo_title: z.string().nullable().optional().describe("SEO 標題（Rank Math），空字串＝清除"),
  seo_description: z.string().nullable().optional().describe("Meta 描述，空字串＝清除"),
};
const productFields = {
  product_type: z.enum(["simple", "variable", "grouped", "external"]).optional(),
  sku: z.string().nullable().optional(),
  regular_price: z.number().nullable().optional().describe("原價（TWD）"),
  sale_price: z.number().nullable().optional().describe("特價；null = 無特價"),
  sale_from: z.string().nullable().optional(),
  sale_to: z.string().nullable().optional(),
  manage_stock: z.boolean().optional(),
  stock_quantity: z.number().int().nullable().optional(),
  stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(),
  backorders: z.enum(["no", "notify", "yes"]).optional(),
  featured: z.boolean().optional(),
  catalog_visibility: z.enum(["visible", "catalog", "search", "hidden"]).optional(),
  short_description: z.string().optional().describe("商品簡短說明 HTML"),
  gallery_image_ids: z.array(z.number().int()).optional(),
  weight: z.number().nullable().optional(),
};

function splitProduct(args: Record<string, unknown>) {
  const post: Record<string, unknown> = {};
  const prod: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || k === "id") continue;
    if (k in productFields) prod[k] = v;
    else if (k in postFields) post[k] = v;
  }
  return { post: post as posts.PostInput, prod: prod as products.ProductFields };
}

export function buildServer(actor: Actor) {
  const server = new McpServer(
    { name: "palacetw-cms", version: "1.0.0" },
    {
      instructions:
        "台灣宮廷酒廠（palacetwshop.com 的 Next.js 新站）網站管理。所有寫入都記錄在 site_palacetw.audit_log。" +
        "新增內容預設為草稿（status=draft），確認後用 update_post / update_product 設 status=publish。刪除預設移到回收桶（force=true 才永久刪除）。" +
        "價格幣別為新台幣；結帳只建立待付款訂單，不串接金流。訂單／顧客／優惠券資料待舊站資料庫備份匯入。",
    },
  );
  const reg = (name: string, cfg: { title: string; description: string; inputSchema: Record<string, z.ZodTypeAny>; annotations: object }, fn: (a: any) => Promise<unknown>) =>
    server.registerTool(name, cfg as any, h(fn) as any);

  /* ------------------------------------------------------------- site */
  reg("site_info", { title: "網站概況", description: "網站名稱、網址與各類內容數量。", inputSchema: {}, annotations: RO }, async () => ({
    url: SITE_URL, settings: await site.getSettings(false), counts: await site.dashboardCounts(),
  }));
  reg("get_settings", { title: "讀取網站設定", description: "讀取所有網站設定（名稱、logo、聯絡資訊、追蹤碼…）。", inputSchema: {}, annotations: RO }, () => site.getSettings(true));
  reg("update_setting", {
    title: "修改網站設定",
    description: `寫入一個設定鍵（整個值取代）。常用鍵：${Object.entries(site.EDITABLE_SETTINGS).map(([k, v]) => `${k}=${v.label}`).join("；")}。建議先 get_settings 取現值再改。`,
    inputSchema: { key: z.string(), value: z.any().describe("JSON 值（字串、物件…）") }, annotations: WR,
  }, (a) => site.setSetting(actor, a.key, a.value));

  /* ---------------------------------------------------- posts / pages */
  reg("list_posts", {
    title: "列出文章／頁面", description: "列出 post / page / ocean_modal_window（彈出視窗）。商品請用 list_products。",
    inputSchema: { type: z.enum(["post", "page", "ocean_modal_window"]).default("post"), status: z.enum(["any", "publish", "draft", "pending", "private", "future", "trash"]).optional(), search: z.string().optional(), category_id: z.number().int().optional(), ...page },
    annotations: RO,
  }, (a) => posts.listPosts({ type: a.type, status: a.status, search: a.search, category_id: a.category_id, limit: a.limit, offset: a.offset }));
  reg("get_post", { title: "讀取文章／頁面／商品內容", description: "依 ID 讀取完整內容（含 HTML、SEO、分類）。", inputSchema: { id }, annotations: RO }, (a) => posts.getPost(a.id));
  reg("create_post", {
    title: "新增文章／頁面", description: "新增 post 或 page，預設草稿。", inputSchema: { type: z.enum(["post", "page", "ocean_modal_window"]).default("post"), ...postFields }, annotations: WR,
  }, (a) => { const { type, ...rest } = a; return posts.createPost(actor, type, { ...rest, status: rest.status ?? "draft" }); });
  reg("update_post", { title: "修改文章／頁面", description: "只會修改有提供的欄位。status=publish 即發布；status=future + date 即排程。", inputSchema: { id, ...postFields }, annotations: WR }, (a) => {
    const { id: pid, ...rest } = a; return posts.updatePost(actor, pid, rest);
  });
  reg("delete_post", { title: "刪除文章／頁面／商品", description: "預設移到回收桶；force=true 永久刪除（不可復原）。", inputSchema: { id, force: z.boolean().optional() }, annotations: DEL }, (a) => posts.deletePost(actor, a.id, !!a.force));
  reg("restore_post", { title: "從回收桶還原", description: "還原到移入回收桶前的狀態。", inputSchema: { id }, annotations: WR }, (a) => posts.restorePost(actor, a.id));

  /* -------------------------------------------------------- products */
  reg("list_products", {
    title: "列出商品", description: "商品清單含 SKU、價格、庫存。",
    inputSchema: { status: z.enum(["any", "publish", "draft", "pending", "private", "future", "trash"]).optional(), search: z.string().optional(), category_id: z.number().int().optional(), stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(), ...page },
    annotations: RO,
  }, (a) => products.listProducts(a));
  reg("get_product", { title: "讀取商品", description: "商品完整資料：內文、價格、庫存、變體、屬性、分類。", inputSchema: { id }, annotations: RO }, (a) => products.getProduct(a.id));
  reg("create_product", { title: "新增商品", description: "新增商品（預設草稿）。", inputSchema: { ...postFields, ...productFields }, annotations: WR }, (a) => {
    const { post, prod } = splitProduct(a);
    return products.saveProduct(actor, null, { ...post, status: post.status ?? "draft" }, prod);
  });
  reg("update_product", { title: "修改商品", description: "修改商品內容與商品資料（只改有提供的欄位）。", inputSchema: { id, ...postFields, ...productFields }, annotations: WR }, (a) => {
    const { post, prod } = splitProduct(a);
    return products.saveProduct(actor, a.id, post, prod);
  });
  reg("set_price_stock", {
    title: "調整價格與庫存", description: "調整商品或變體的原價／特價／庫存。adjust_stock_by 可用正負數增減庫存。",
    inputSchema: { product_id: z.number().int().optional(), variation_id: z.number().int().optional(), regular_price: z.number().nullable().optional(), sale_price: z.number().nullable().optional(), manage_stock: z.boolean().optional(), stock_quantity: z.number().int().nullable().optional(), adjust_stock_by: z.number().int().optional(), stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional() },
    annotations: WR,
  }, (a) => { const { product_id, variation_id, ...f } = a; return products.setPriceStock(actor, { product_id, variation_id }, f); });
  reg("save_variation", {
    title: "新增／修改商品變體", description: "variation_id 省略即新增。attributes 例：{\"容量\":\"600ml\"}。",
    inputSchema: { product_id: id, variation_id: z.number().int().optional(), attributes: z.record(z.string(), z.string()).optional(), sku: z.string().nullable().optional(), regular_price: z.number().nullable().optional(), sale_price: z.number().nullable().optional(), manage_stock: z.boolean().optional(), stock_quantity: z.number().int().nullable().optional(), stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(), description: z.string().optional(), status: z.enum(["publish", "private", "draft"]).optional(), image_id: z.number().int().nullable().optional() },
    annotations: WR,
  }, (a) => { const { product_id, variation_id, ...v } = a; return products.saveVariation(actor, product_id, variation_id ?? null, v); });
  reg("delete_variation", { title: "刪除商品變體", description: "永久刪除一個變體。", inputSchema: { variation_id: id }, annotations: DEL }, (a) => products.deleteVariation(actor, a.variation_id));

  /* ----------------------------------------------------------- terms */
  const taxEnum = z.enum(["category", "post_tag", "product_cat", "product_tag"]);
  reg("list_terms", { title: "列出分類／標籤", description: "category / post_tag / product_cat / product_tag。", inputSchema: { taxonomy: taxEnum.optional() }, annotations: RO }, (a) => terms.listTerms(a.taxonomy));
  reg("create_term", { title: "新增分類／標籤", description: "新增分類或標籤。", inputSchema: { taxonomy: taxEnum, name: z.string(), slug: z.string().optional(), description: z.string().optional(), parent_id: z.number().int().nullable().optional() }, annotations: WR }, (a) => {
    const { taxonomy, ...rest } = a; return terms.createTerm(actor, taxonomy, rest);
  });
  reg("update_term", { title: "修改分類／標籤", description: "修改名稱、代稱（會自動建立 301）、說明、上層。", inputSchema: { id, name: z.string().optional(), slug: z.string().optional(), description: z.string().optional(), parent_id: z.number().int().nullable().optional() }, annotations: WR }, (a) => {
    const { id: tid, ...rest } = a; return terms.updateTerm(actor, tid, rest);
  });
  reg("delete_term", { title: "刪除分類／標籤", description: "刪除分類；子分類移到其上層，內容的關聯一併移除。", inputSchema: { id }, annotations: DEL }, (a) => terms.deleteTerm(actor, a.id));

  /* ----------------------------------------------------------- media */
  reg("list_media", { title: "列出媒體", description: "媒體庫清單。", inputSchema: { search: z.string().optional(), mime: z.string().optional().describe("例 image、application/pdf"), ...page }, annotations: RO }, (a) => media.listMedia(a));
  reg("upload_media", {
    title: "上傳媒體", description: "從公開網址或 base64 上傳；圖片自動轉 WebP（最長邊 2000、品質 80），GIF/影片/PDF 保留原檔。",
    inputSchema: { url: z.string().optional(), base64: z.string().optional(), filename: z.string().optional().describe("base64 上傳時必填，含副檔名"), title: z.string().optional(), alt_text: z.string().optional(), caption: z.string().optional() },
    annotations: { ...WR, openWorldHint: true },
  }, async (a) => {
    let file: { bytes: Buffer; filename: string; mime?: string };
    if (a.url) file = await media.fetchRemote(a.url);
    else if (a.base64 && a.filename) file = { bytes: Buffer.from(a.base64.replace(/^data:[^,]+,/, ""), "base64"), filename: a.filename };
    else throw new AdminError("需要 url，或 base64 + filename");
    return media.uploadMedia(actor, file, { title: a.title, alt_text: a.alt_text, caption: a.caption });
  });
  reg("update_media", { title: "修改媒體資訊", description: "修改標題、替代文字、說明。", inputSchema: { id, title: z.string().optional(), alt_text: z.string().optional(), caption: z.string().optional(), description: z.string().optional() }, annotations: WR }, (a) => {
    const { id: mid, ...rest } = a; return media.updateMedia(actor, mid, rest);
  });
  reg("delete_media", { title: "刪除媒體", description: "永久刪除檔案與媒體紀錄。", inputSchema: { id }, annotations: DEL }, (a) => media.deleteMedia(actor, a.id));

  /* ---------------------------------------------------------- orders */
  reg("list_orders", {
    title: "查詢訂單", description: "依狀態、關鍵字（訂單編號、email、姓名、電話）、日期查詢訂單。",
    inputSchema: { status: z.enum(["any", ...Object.keys(commerce.ORDER_STATUSES)] as [string, ...string[]]).optional(), search: z.string().optional(), from: z.string().optional(), to: z.string().optional(), customer_id: z.number().int().optional(), ...page },
    annotations: RO,
  }, (a) => commerce.listOrders(a));
  reg("get_order", { title: "訂單明細", description: "訂單完整資料：品項、地址、備註。", inputSchema: { id }, annotations: RO }, (a) => commerce.getOrder(a.id));
  reg("update_order_status", {
    title: "更新訂單狀態", description: `狀態：${Object.entries(commerce.ORDER_STATUSES).map(([k, v]) => `${k}=${v}`).join("、")}。轉為處理中/完成會扣庫存，取消/退款會回補。`,
    inputSchema: { id, status: z.enum(Object.keys(commerce.ORDER_STATUSES) as [string, ...string[]]), note: z.string().optional() }, annotations: WR,
  }, (a) => commerce.updateOrderStatus(actor, a.id, a.status, a.note));
  reg("add_order_note", { title: "新增訂單備註", description: "新增內部備註或給顧客的備註。", inputSchema: { id, content: z.string(), customer_note: z.boolean().optional() }, annotations: WR }, (a) => commerce.addOrderNote(actor, a.id, a.content, !!a.customer_note));
  reg("list_customers", { title: "列出顧客", description: "顧客清單（email、姓名、帳單資料）。", inputSchema: { search: z.string().optional(), ...page }, annotations: RO }, (a) => commerce.listCustomers(a));
  reg("get_customer", { title: "顧客明細", description: "顧客資料與訂單紀錄。", inputSchema: { id }, annotations: RO }, (a) => commerce.getCustomer(a.id));

  /* --------------------------------------------- coupons & discounts */
  reg("list_coupons", { title: "列出優惠券", description: "所有優惠券。", inputSchema: {}, annotations: RO }, () => commerce.listCoupons());
  reg("save_coupon", {
    title: "新增／修改優惠券", description: "id 省略即新增。discount_type：percent / fixed_cart / fixed_product。",
    inputSchema: { id: z.number().int().optional(), code: z.string().optional(), description: z.string().optional(), discount_type: z.enum(["percent", "fixed_cart", "fixed_product"]).optional(), amount: z.number().optional(), date_expires: z.string().nullable().optional(), status: z.enum(["publish", "draft"]).optional(), minimum_amount: z.number().nullable().optional(), maximum_amount: z.number().nullable().optional(), usage_limit: z.number().int().nullable().optional(), usage_limit_per_user: z.number().int().nullable().optional(), individual_use: z.boolean().optional(), free_shipping: z.boolean().optional(), exclude_sale_items: z.boolean().optional(), product_ids: z.array(z.number().int()).optional(), product_categories: z.array(z.number().int()).optional() },
    annotations: WR,
  }, (a) => { const { id: cid, ...rest } = a; return commerce.saveCoupon(actor, cid ?? null, rest); });
  reg("delete_coupon", { title: "刪除優惠券", description: "永久刪除優惠券。", inputSchema: { id }, annotations: DEL }, (a) => commerce.deleteCoupon(actor, a.id));
  reg("list_discount_rules", { title: "列出數量折扣規則", description: "數量／批量折扣規則。", inputSchema: {}, annotations: RO }, () => commerce.listRules());
  reg("save_discount_rule", {
    title: "新增／修改數量折扣規則", description: "scope：all / product / variation / product_cat；discount_type：percent / fixed_amount / fixed_price。",
    inputSchema: { id: z.number().int().optional(), name: z.string().optional(), scope: z.enum(["all", "product", "variation", "product_cat"]).optional(), product_id: z.number().int().nullable().optional(), variation_id: z.number().int().nullable().optional(), term_id: z.number().int().nullable().optional(), min_qty: z.number().int().optional(), max_qty: z.number().int().nullable().optional(), discount_type: z.enum(["percent", "fixed_amount", "fixed_price"]).optional(), amount: z.number().optional(), priority: z.number().int().optional(), active: z.boolean().optional() },
    annotations: WR,
  }, (a) => { const { id: rid, ...rest } = a; return commerce.saveRule(actor, rid ?? null, rest); });
  reg("delete_discount_rule", { title: "刪除數量折扣規則", description: "永久刪除規則。", inputSchema: { id }, annotations: DEL }, (a) => commerce.deleteRule(actor, a.id));

  /* ----------------------------------------------------------- forms */
  reg("list_forms", { title: "列出表單", description: "表單與提交數。", inputSchema: {}, annotations: RO }, () => site.listForms());
  reg("list_form_submissions", { title: "查詢表單提交", description: "表單提交內容。", inputSchema: { form_id: z.number().int().optional(), status: z.enum(["any", "unread", "read", "spam", "trash"]).optional(), search: z.string().optional(), ...page }, annotations: RO }, (a) => site.listSubmissions(a));
  reg("set_submission_status", { title: "標記表單提交", description: "標為已讀、未讀、垃圾或回收桶。", inputSchema: { ids: z.array(z.number().int()).min(1), status: z.enum(["unread", "read", "spam", "trash"]) }, annotations: WR }, (a) => site.setSubmissionStatus(actor, a.ids, a.status));

  /* ----------------------------------------------------------- menus */
  reg("list_menus", { title: "列出選單", description: "導覽選單。", inputSchema: {}, annotations: RO }, () => site.listMenus());
  reg("get_menu", { title: "讀取選單", description: "選單與所有項目。", inputSchema: { id }, annotations: RO }, (a) => site.getMenu(a.id));
  reg("save_menu_items", {
    title: "儲存選單項目", description: "整組取代選單項目；陣列順序即顯示順序，子項目以 parent_key 指向父項目的 key。",
    inputSchema: { menu_id: id, items: z.array(z.object({ key: z.string(), parent_key: z.string().nullable().optional(), title: z.string(), url: z.string().nullable().optional(), target: z.string().nullable().optional(), classes: z.array(z.string()).optional() })) },
    annotations: WR,
  }, (a) => site.saveMenuItems(actor, a.menu_id, a.items));

  /* ------------------------------------------------------- redirects */
  reg("list_redirects", { title: "列出轉址", description: "轉址規則。", inputSchema: { search: z.string().optional(), kind: z.string().optional(), ...page }, annotations: RO }, (a) => site.listRedirects(a));
  reg("save_redirect", { title: "新增／修改轉址", description: "來源路徑（/ 開頭）→ 目標網址；狀態碼 301/302/307/308/410。", inputSchema: { id: z.number().int().optional(), source_path: z.string(), target: z.string(), status_code: z.number().int().optional() }, annotations: WR }, (a) => {
    const { id: rid, ...rest } = a; return site.saveRedirect(actor, rid ?? null, rest);
  });
  reg("delete_redirect", { title: "刪除轉址", description: "刪除一條轉址規則。", inputSchema: { id }, annotations: DEL }, (a) => site.deleteRedirect(actor, a.id));

  /* ------------------------------------------------------------ audit */
  reg("list_audit_log", { title: "稽核紀錄", description: "所有後台與 MCP 寫入紀錄。", inputSchema: { actor_type: z.enum(["admin", "mcp", "system"]).optional(), entity_type: z.string().optional(), search: z.string().optional(), ...page }, annotations: RO }, (a) => site.listAudit(a));

  return server;
}
