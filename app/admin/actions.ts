"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { adminActor } from "@/lib/admin/guard";
import { AdminError, type Actor } from "@/lib/admin/core";
import * as posts from "@/lib/admin/posts";
import * as products from "@/lib/admin/products";
import * as terms from "@/lib/admin/terms";
import * as media from "@/lib/admin/media";
import * as commerce from "@/lib/admin/commerce";
import * as site from "@/lib/admin/site";

/* ------------------------------------------------------------- helpers */

function withParam(url: string, k: string, v: string) {
  const [p, h] = url.split("#");
  const base = p.replace(/([?&])(msg|err)=[^&]*/g, "$1").replace(/&&+/g, "&").replace(/[?&]+$/, "");
  return `${base}${base.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}${h ? "#" + h : ""}`;
}

/** Run an admin write; redirect back with ?msg= on success or ?err= on failure. */
async function act(back: string, okMsg: string, fn: (actor: Actor) => Promise<string | void>) {
  let dest: string;
  try {
    const actor = await adminActor();
    const to = await fn(actor);
    dest = withParam(to || back, "msg", okMsg);
  } catch (e) {
    unstable_rethrow(e);
    const msg = e instanceof AdminError ? e.message : `發生錯誤：${(e as Error)?.message || e}`;
    if (!(e instanceof AdminError)) console.error("[admin]", e);
    dest = withParam(back, "err", msg);
  }
  redirect(dest);
}

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "");
const has = (fd: FormData, k: string) => fd.has(k);
const optS = (fd: FormData, k: string) => (fd.has(k) ? String(fd.get(k) ?? "") : undefined);
const nOrNull = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new AdminError(`「${k}」必須是數字`);
  return n;
};
const optN = (fd: FormData, k: string) => (fd.has(k) ? nOrNull(fd, k) : undefined);
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1" || fd.get(k) === "true";
const ids = (fd: FormData, k: string) => fd.getAll(k).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
const back = (fd: FormData, fallback: string) => {
  const b = s(fd, "_back");
  return b.startsWith("/admin") ? b : fallback;
};
/** <input type="datetime-local"> is Asia/Taipei wall time → ISO */
const localToIso = (v: string) => (v ? new Date(`${v}:00+08:00`).toISOString() : null);

/* --------------------------------------------------- posts / products */

export async function savePostAction(fd: FormData) {
  const id = Number(s(fd, "id")) || null;
  const type = s(fd, "type") || "post";
  const intent = s(fd, "intent") || "update";
  const listUrl = type === "product" ? "/admin/products/" : `/admin/posts/?type=${type}`;
  const editUrl = (pid: number) => (type === "product" ? `/admin/products/${pid}/` : `/admin/posts/${pid}/`);
  const fallback = id ? editUrl(id) : type === "product" ? "/admin/products/new/" : `/admin/posts/new/?type=${type}`;
  const msgs: Record<string, string> = { draft: "已儲存草稿", publish: "已發布", schedule: "已排程", update: "已更新", preview: "已儲存，開啟預覽", pending: "已送審" };
  await act(fallback, msgs[intent] || "已儲存", async (actor) => {
    const input: posts.PostInput = {
      title: s(fd, "title"),
      content: s(fd, "content"),
      excerpt: optS(fd, "excerpt"),
      slug: optS(fd, "slug") || undefined,
      featured_media_id: optN(fd, "featured_media_id"),
      menu_order: optN(fd, "menu_order") ?? undefined,
      seo_title: optS(fd, "seo_title"),
      seo_description: optS(fd, "seo_description"),
    };
    if (has(fd, "parent_id")) input.parent_id = nOrNull(fd, "parent_id");
    if (has(fd, "comment_status_present")) input.comment_status = bool(fd, "comment_status") ? "open" : "closed";
    if (has(fd, "terms_present")) {
      input.category_ids = ids(fd, "category_ids");
      input.tag_ids = ids(fd, "tag_ids");
    }
    const date = localToIso(s(fd, "date"));
    if (intent === "draft") input.status = "draft";
    else if (intent === "pending") input.status = "pending";
    else if (intent === "publish") { input.status = "publish"; input.date = date; }
    else if (intent === "schedule") {
      if (!date) throw new AdminError("排程需要設定發布時間");
      input.status = "future"; input.date = date;
    } else {
      // update / preview: keep current status, but allow date and visibility changes
      if (!id) input.status = "draft";
      if (date) input.date = date;
      const vis = s(fd, "visibility");
      if (vis === "private") input.status = "private";
    }
    let pid: number;
    if (type === "product") {
      const f: products.ProductFields = {
        product_type: (s(fd, "product_type") || "simple") as products.ProductFields["product_type"],
        sku: s(fd, "sku").trim() || null,
        regular_price: nOrNull(fd, "regular_price"),
        sale_price: nOrNull(fd, "sale_price"),
        sale_from: localToIso(s(fd, "sale_from")),
        sale_to: localToIso(s(fd, "sale_to")),
        manage_stock: bool(fd, "manage_stock"),
        stock_quantity: nOrNull(fd, "stock_quantity"),
        stock_status: (s(fd, "stock_status") || "instock") as products.ProductFields["stock_status"],
        backorders: (s(fd, "backorders") || "no") as products.ProductFields["backorders"],
        featured: bool(fd, "featured"),
        catalog_visibility: (s(fd, "catalog_visibility") || "visible") as products.ProductFields["catalog_visibility"],
        short_description: s(fd, "short_description"),
        gallery_image_ids: s(fd, "gallery_image_ids").split(/[\s,]+/).map(Number).filter((n) => n > 0),
        weight: nOrNull(fd, "weight"),
        purchase_note: s(fd, "purchase_note"),
        min_qty: nOrNull(fd, "min_qty") ?? 1,
        max_qty: nOrNull(fd, "max_qty"),
        qty_step: nOrNull(fd, "qty_step") ?? 1,
      };
      pid = (await products.saveProduct(actor, id, input, f)).id as number;
    } else if (id) {
      pid = (await posts.updatePost(actor, id, input)).id as number;
    } else {
      pid = (await posts.createPost(actor, type, input)).id as number;
    }
    if (intent === "preview") return `/admin/preview/${pid}/`;
    return editUrl(pid);
  });
  void listUrl;
}

export async function trashPostAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(back(fd, "/admin/posts/"), "已移到回收桶", async (a) => { await posts.deletePost(a, id, false); });
}
export async function restorePostAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(back(fd, "/admin/posts/"), "已還原", async (a) => { await posts.restorePost(a, id); });
}
export async function deletePostAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(back(fd, "/admin/posts/"), "已永久刪除", async (a) => { await posts.deletePost(a, id, true); });
}

export async function quickPriceStockAction(fd: FormData) {
  const pid = Number(s(fd, "product_id"));
  await act(back(fd, "/admin/products/"), "價格／庫存已更新", async (a) => {
    await products.setPriceStock(a, { product_id: pid }, { regular_price: nOrNull(fd, "regular_price"), sale_price: nOrNull(fd, "sale_price"), stock_quantity: optN(fd, "stock_quantity"), manage_stock: has(fd, "stock_quantity") && s(fd, "stock_quantity") !== "" ? true : undefined, stock_status: s(fd, "stock_status") || undefined });
  });
}

export async function saveVariationAction(fd: FormData) {
  const pid = Number(s(fd, "product_id"));
  const vid = Number(s(fd, "variation_id")) || null;
  await act(`/admin/products/${pid}/#variations`, vid ? "變體已更新" : "已新增變體", async (a) => {
    const attrs: Record<string, string> = {};
    for (const line of s(fd, "attributes").split(/\n|;/)) {
      const [k, ...v] = line.split(/[:：=]/);
      if (k?.trim() && v.join(":").trim()) attrs[k.trim()] = v.join(":").trim();
    }
    await products.saveVariation(a, pid, vid, {
      attributes: attrs, sku: s(fd, "sku").trim() || null, regular_price: nOrNull(fd, "regular_price"), sale_price: nOrNull(fd, "sale_price"),
      manage_stock: bool(fd, "manage_stock"), stock_quantity: nOrNull(fd, "stock_quantity"), stock_status: s(fd, "stock_status") || "instock",
      status: (s(fd, "status") || "publish") as "publish", description: s(fd, "description"), image_id: nOrNull(fd, "image_id"),
    });
  });
}
export async function deleteVariationAction(fd: FormData) {
  const pid = Number(s(fd, "product_id"));
  await act(`/admin/products/${pid}/#variations`, "已刪除變體", async (a) => { await products.deleteVariation(a, Number(s(fd, "variation_id"))); });
}
export async function saveAttributesAction(fd: FormData) {
  const pid = Number(s(fd, "product_id"));
  await act(`/admin/products/${pid}/#variations`, "屬性已更新", async (a) => {
    const rows = s(fd, "attributes").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [name, opts = ""] = l.split(/[:：]/);
      return { name: name.trim(), options: opts.split("|").map((o) => o.trim()).filter(Boolean), used_for_variations: true, visible: true };
    });
    await products.saveAttributes(a, pid, rows);
  });
}

/* --------------------------------------------------------------- terms */

export async function saveTermAction(fd: FormData) {
  const tax = s(fd, "taxonomy");
  const id = Number(s(fd, "id")) || null;
  await act(`/admin/terms/?taxonomy=${tax}`, id ? "已更新" : "已新增", async (a) => {
    const input = { name: s(fd, "name"), slug: s(fd, "slug") || undefined, description: s(fd, "description"), parent_id: nOrNull(fd, "parent_id"), image_id: optN(fd, "image_id") };
    if (id) await terms.updateTerm(a, id, input);
    else await terms.createTerm(a, tax, input);
  });
}
export async function deleteTermAction(fd: FormData) {
  await act(`/admin/terms/?taxonomy=${s(fd, "taxonomy")}`, "已刪除", async (a) => { await terms.deleteTerm(a, Number(s(fd, "id"))); });
}

/* --------------------------------------------------------------- media */

export async function uploadMediaAction(fd: FormData) {
  const files = fd.getAll("files").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f && f.size > 0);
  let n = 0;
  await act(back(fd, "/admin/media/"), `已上傳 ${files.length} 個檔案`, async (a) => {
    if (!files.length) throw new AdminError("請選擇檔案");
    for (const f of files) {
      await media.uploadMedia(a, { bytes: Buffer.from(await f.arrayBuffer()), filename: f.name, mime: f.type });
      n++;
    }
  });
  void n;
}
export async function updateMediaAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(`/admin/media/${id}/`, "已更新", async (a) => { await media.updateMedia(a, id, { title: s(fd, "title"), alt_text: s(fd, "alt_text"), caption: s(fd, "caption"), description: s(fd, "description") }); });
}
export async function deleteMediaAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(`/admin/media/${id}/`, "已刪除", async (a) => { await media.deleteMedia(a, id); return "/admin/media/"; });
}

/* -------------------------------------------------------------- orders */

export async function orderStatusAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(back(fd, `/admin/orders/${id}/`), "訂單已更新", async (a) => { await commerce.updateOrderStatus(a, id, s(fd, "status"), s(fd, "note").trim() || undefined); });
}
export async function bulkOrderStatusAction(fd: FormData) {
  const list = ids(fd, "ids");
  await act(back(fd, "/admin/orders/"), `已更新 ${list.length} 筆訂單`, async (a) => {
    const st = s(fd, "status");
    if (!st) throw new AdminError("請選擇狀態");
    for (const id of list) await commerce.updateOrderStatus(a, id, st);
  });
}
export async function orderNoteAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(`/admin/orders/${id}/`, "已新增備註", async (a) => { await commerce.addOrderNote(a, id, s(fd, "content"), bool(fd, "customer_note")); });
}
export async function orderAddressAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  const kind = s(fd, "kind") === "shipping" ? "shipping" : "billing";
  await act(`/admin/orders/${id}/`, "地址已更新", async (a) => {
    const addr: Record<string, string> = {};
    for (const k of ["first_name", "last_name", "company", "address_1", "address_2", "city", "state", "postcode", "country", "email", "phone"]) if (fd.has(k)) addr[k] = s(fd, k);
    await commerce.updateOrderAddress(a, id, kind, addr);
  });
}

export async function customerAction(fd: FormData) {
  const id = Number(s(fd, "id"));
  await act(`/admin/customers/${id}/`, "顧客資料已更新", async (a) => {
    const billing: Record<string, string> = {};
    for (const k of ["phone", "company", "address_1", "address_2", "city", "state", "postcode", "country"]) if (fd.has(`billing_${k}`)) billing[k] = s(fd, `billing_${k}`);
    await commerce.updateCustomer(a, id, { first_name: s(fd, "first_name"), last_name: s(fd, "last_name"), display_name: s(fd, "display_name"), billing });
  });
}

/* ------------------------------------------------- coupons / discounts */

export async function couponAction(fd: FormData) {
  const id = Number(s(fd, "id")) || null;
  await act(id ? `/admin/coupons/${id}/` : "/admin/coupons/new/", id ? "優惠券已更新" : "已新增優惠券", async (a) => {
    const c = await commerce.saveCoupon(a, id, {
      code: s(fd, "code"), description: s(fd, "description"), discount_type: s(fd, "discount_type") as commerce.CouponInput["discount_type"], amount: nOrNull(fd, "amount") ?? 0,
      date_expires: s(fd, "date_expires") ? new Date(`${s(fd, "date_expires")}T23:59:59+08:00`).toISOString() : null, status: s(fd, "status") || "publish",
      individual_use: bool(fd, "individual_use"), free_shipping: bool(fd, "free_shipping"), exclude_sale_items: bool(fd, "exclude_sale_items"),
      minimum_amount: nOrNull(fd, "minimum_amount"), maximum_amount: nOrNull(fd, "maximum_amount"), usage_limit: nOrNull(fd, "usage_limit"),
      usage_limit_per_user: nOrNull(fd, "usage_limit_per_user"), limit_usage_to_x_items: nOrNull(fd, "limit_usage_to_x_items"),
      product_ids: ids(fd, "product_ids"), excluded_product_ids: ids(fd, "excluded_product_ids"), product_categories: ids(fd, "product_categories"), excluded_product_categories: ids(fd, "excluded_product_categories"),
      email_restrictions: s(fd, "email_restrictions").split(/[\s,]+/).map((e) => e.trim().toLowerCase()).filter(Boolean),
    });
    return `/admin/coupons/${c.id}/`;
  });
}
export async function deleteCouponAction(fd: FormData) {
  await act("/admin/coupons/", "已刪除優惠券", async (a) => { await commerce.deleteCoupon(a, Number(s(fd, "id"))); });
}
export async function ruleAction(fd: FormData) {
  const id = Number(s(fd, "id")) || null;
  await act("/admin/discounts/", id ? "規則已更新" : "已新增規則", async (a) => {
    await commerce.saveRule(a, id, {
      name: s(fd, "name"), scope: s(fd, "scope") as commerce.RuleInput["scope"], product_id: nOrNull(fd, "product_id"), variation_id: nOrNull(fd, "variation_id"), term_id: nOrNull(fd, "term_id"),
      min_qty: nOrNull(fd, "min_qty") ?? 1, max_qty: nOrNull(fd, "max_qty"), discount_type: s(fd, "discount_type") as commerce.RuleInput["discount_type"], amount: nOrNull(fd, "amount") ?? 0,
      priority: nOrNull(fd, "priority") ?? 10, active: bool(fd, "active"), starts_at: localToIso(s(fd, "starts_at")), ends_at: localToIso(s(fd, "ends_at")),
    });
  });
}
export async function deleteRuleAction(fd: FormData) {
  await act("/admin/discounts/", "已刪除規則", async (a) => { await commerce.deleteRule(a, Number(s(fd, "id"))); });
}

/* --------------------------------------------------------------- menus */

export async function menuAction(fd: FormData) {
  const id = Number(s(fd, "id")) || null;
  await act(id ? `/admin/menus/${id}/` : "/admin/menus/", id ? "選單已更新" : "已建立選單", async (a) => {
    const m = await site.saveMenu(a, id, { name: s(fd, "name"), locations: bool(fd, "primary") ? ["main_menu"] : [] });
    if (bool(fd, "primary")) await site.setSetting(a, "primary_menu", { slug: m.slug, menu_id: m.id, location: "main_menu" });
    if (fd.has("items_json")) {
      let items: site.MenuItemInput[];
      try { items = JSON.parse(s(fd, "items_json")); } catch { throw new AdminError("選單項目格式錯誤"); }
      await site.saveMenuItems(a, m.id, items);
    }
    return `/admin/menus/${m.id}/`;
  });
}
export async function deleteMenuAction(fd: FormData) {
  await act("/admin/menus/", "已刪除選單", async (a) => { await site.deleteMenu(a, Number(s(fd, "id"))); });
}

/* ------------------------------------------------- forms / comments */

export async function submissionStatusAction(fd: FormData) {
  const list = ids(fd, "ids");
  await act(back(fd, "/admin/forms/"), "已更新", async (a) => {
    if (!list.length) throw new AdminError("請勾選項目");
    await site.setSubmissionStatus(a, list, s(fd, "status") as "read");
  });
}
export async function commentStatusAction(fd: FormData) {
  const list = ids(fd, "ids");
  const st = s(fd, "status");
  await act(back(fd, "/admin/comments/"), "已更新", async (a) => {
    if (!list.length) throw new AdminError("請勾選留言");
    if (st === "delete") await site.deleteComments(a, list);
    else await site.setCommentStatus(a, list, st as "approved");
  });
}

/* ------------------------------------------------------------ settings */

export async function settingsAction(fd: FormData) {
  await act("/admin/settings/", "設定已儲存", async (a) => {
    const cur = await site.getSettings(true);
    await site.setSetting(a, "blogname", s(fd, "blogname").trim());
    await site.setSetting(a, "blogdescription", s(fd, "blogdescription").trim());
    const logoId = nOrNull(fd, "logo_media_id");
    let logoUrl: string | null = null;
    if (logoId) logoUrl = (await media.getMedia(logoId)).public_url;
    await site.setSetting(a, "site_logo", { media_id: logoId, url: logoUrl });
    const iconId = nOrNull(fd, "icon_media_id");
    if (iconId && iconId !== cur.site_icon?.media_id) await site.setSetting(a, "site_icon", { ...(cur.site_icon || {}), media_id: iconId, url: (await media.getMedia(iconId)).public_url });
    const contact: Record<string, string | null> = { ...(cur.contact || {}) };
    for (const k of ["tel", "email", "line", "facebook", "instagram", "youtube", "messenger", "address"]) contact[k] = s(fd, `contact_${k}`).trim() || null;
    await site.setSetting(a, "contact", contact);
    const tracking: Record<string, string | null> = { ...(cur.tracking || {}) };
    for (const k of ["ga", "gtm", "facebook_pixel_id", "facebook_domain_verification"]) {
      const v = s(fd, `tracking_${k}`).trim();
      if (v && !/^[A-Za-z0-9_-]{2,64}$/.test(v)) throw new AdminError(`追蹤碼「${k}」格式不正確（只允許英數、- 與 _）`);
      tracking[k] = v || null;
    }
    await site.setSetting(a, "tracking", tracking);
    await site.setSetting(a, "topbar", { enabled: bool(fd, "topbar_enabled"), text: s(fd, "topbar_text").trim() || null });
  });
}
export async function rawSettingAction(fd: FormData) {
  await act("/admin/settings/#advanced", "設定已儲存", async (a) => {
    let v: unknown;
    try { v = JSON.parse(s(fd, "value")); } catch { throw new AdminError("JSON 格式錯誤"); }
    await site.setSetting(a, s(fd, "key"), v);
  });
}

/* ----------------------------------------------------------- redirects */

export async function redirectAction(fd: FormData) {
  const id = Number(s(fd, "id")) || null;
  await act(back(fd, "/admin/redirects/"), id ? "轉址已更新" : "已新增轉址", async (a) => {
    await site.saveRedirect(a, id, { source_path: s(fd, "source_path"), target: s(fd, "target"), status_code: Number(s(fd, "status_code")) || 301 });
  });
}
export async function deleteRedirectAction(fd: FormData) {
  await act(back(fd, "/admin/redirects/"), "已刪除轉址", async (a) => { await site.deleteRedirect(a, Number(s(fd, "id"))); });
}
