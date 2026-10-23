import "server-only";
import { AdminError, type Actor, audit, must, refreshSite, sb, int } from "./core";

/* -------------------------------------------------------------- settings */

/** Keys editable from the admin / MCP, with the public flag they are stored under. */
export const EDITABLE_SETTINGS: Record<string, { label: string; public: boolean }> = {
  blogname: { label: "網站名稱", public: true },
  blogdescription: { label: "網站標語", public: true },
  site_logo: { label: "Logo（{media_id,url}）", public: true },
  site_icon: { label: "網站圖示（{url}）", public: true },
  contact: { label: "聯絡資訊", public: true },
  tracking: { label: "追蹤碼（GA4 / GTM / FB Pixel / 網域驗證）", public: true },
  topbar: { label: "頂部列", public: true },
  chat_widget: { label: "聊天按鈕", public: true },
  reading: { label: "閱讀設定", public: true },
  woocommerce: { label: "WooCommerce 設定", public: true },
  timezone: { label: "時區", public: true },
};

export async function getSettings(includePrivate = true) {
  let q = sb().from("settings").select("key,value,is_public,updated_at");
  if (!includePrivate) q = q.eq("is_public", true);
  const rows = (must(await q.order("key")) as any[]) || [];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setSetting(actor: Actor, key: string, value: unknown) {
  if (!/^[a-z0-9_]{2,64}$/.test(key)) throw new AdminError("設定鍵只能是小寫英數與底線");
  if (value === undefined) throw new AdminError("缺少設定值");
  const { data: before } = await sb().from("settings").select("value,is_public").eq("key", key).maybeSingle();
  const isPublic = before ? before.is_public : EDITABLE_SETTINGS[key]?.public ?? false;
  must(await sb().from("settings").upsert({ key, value, is_public: isPublic }, { onConflict: "key" }));
  await audit(actor, "setting.update", "setting", key, before?.value ?? null, value);
  refreshSite();
  return { key, value };
}

/* ----------------------------------------------------------------- menus */

export async function listMenus() {
  const menus = (must(await sb().from("menus").select("*").order("id")) as any[]) || [];
  const items = (must(await sb().from("menu_items").select("id,menu_id")) as any[]) || [];
  return menus.map((m) => ({ ...m, item_count: items.filter((i) => i.menu_id === m.id).length }));
}

export async function getMenu(id: number) {
  const menu = must(await sb().from("menus").select("*").eq("id", id).maybeSingle()) as any;
  if (!menu) throw new AdminError(`找不到選單 ${id}`, 404);
  const items = must(await sb().from("menu_items").select("*").eq("menu_id", id).order("position"));
  return { ...menu, items: items || [] };
}

export async function saveMenu(actor: Actor, id: number | null, input: { name?: string; locations?: string[] }) {
  let row: any;
  let before: any = null;
  if (id) {
    before = must(await sb().from("menus").select("*").eq("id", id).maybeSingle());
    if (!before) throw new AdminError(`找不到選單 ${id}`, 404);
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.locations !== undefined) patch.locations = input.locations;
    row = must(await sb().from("menus").update(patch).eq("id", id).select("*").single());
  } else {
    const name = (input.name || "").trim();
    if (!name) throw new AdminError("選單名稱不可為空");
    const slug = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-")).toLowerCase() + "-" + Date.now().toString(36);
    row = must(await sb().from("menus").insert({ name, slug, locations: input.locations ?? [], source: "admin" }).select("*").single());
  }
  await audit(actor, id ? "menu.update" : "menu.create", "menu", row.id, before, row);
  refreshSite();
  return row;
}

export type MenuItemInput = { key: string; parent_key?: string | null; title: string; url?: string | null; target?: string | null; classes?: string[]; object_type?: string; object_id?: number | null; attr_title?: string | null };

/** Replace every item of a menu. Items reference their parent by client-side `key` (order of the array = position). */
export async function saveMenuItems(actor: Actor, menuId: number, items: MenuItemInput[]) {
  const before = await getMenu(menuId);
  for (const it of items) if (!it.title?.trim()) throw new AdminError("每個選單項目都要有標題");
  must(await sb().from("menu_items").delete().eq("menu_id", menuId));
  const idByKey = new Map<string, number>();
  // insert parents before children
  const pending = [...items.map((it, i) => ({ ...it, position: i + 1 }))];
  let guard = 0;
  while (pending.length && guard++ < 1000) {
    const idx = pending.findIndex((p) => !p.parent_key || idByKey.has(p.parent_key) || !items.some((x) => x.key === p.parent_key));
    if (idx < 0) throw new AdminError("選單項目的上層關係有循環");
    const it = pending.splice(idx, 1)[0];
    const row = must(await sb().from("menu_items").insert({
      menu_id: menuId, parent_id: it.parent_key ? idByKey.get(it.parent_key) ?? null : null, position: it.position, title: it.title.trim(),
      url: it.url || null, target: it.target || null, classes: it.classes || [], object_type: it.object_type || "custom", object_id: it.object_id ?? null, attr_title: it.attr_title || null,
    }).select("id").single()) as any;
    idByKey.set(it.key, row.id);
  }
  const after = await getMenu(menuId);
  await audit(actor, "menu.items", "menu", menuId, before.items, after.items);
  refreshSite();
  return after;
}

export async function deleteMenu(actor: Actor, id: number) {
  const before = await getMenu(id);
  must(await sb().from("menus").delete().eq("id", id));
  await audit(actor, "menu.delete", "menu", id, before, null);
  refreshSite();
  return { id, deleted: true };
}

/* ----------------------------------------------------------------- forms */

export async function listForms() {
  const forms = (must(await sb().from("forms").select("id,title,slug,source,status,fields").order("id")) as any[]) || [];
  return Promise.all(forms.map(async (f) => {
    const { count } = await sb().from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", f.id).neq("status", "trash");
    const { count: unread } = await sb().from("form_submissions").select("id", { count: "exact", head: true }).eq("form_id", f.id).eq("status", "unread");
    return { ...f, submissions: count || 0, unread: unread || 0 };
  }));
}

export async function listSubmissions(opts: { form_id?: number; status?: string; limit?: number; offset?: number; search?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 5000);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("form_submissions").select("id,form_id,data,page_url,status,created_at", { count: "exact" });
  if (opts.form_id) q = q.eq("form_id", opts.form_id);
  if (opts.status && opts.status !== "any") q = q.eq("status", opts.status);
  else q = q.neq("status", "trash");
  const res = await q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  let items = res.data || [];
  const s = opts.search?.trim().toLowerCase();
  if (s) items = items.filter((r: any) => JSON.stringify(r.data || {}).toLowerCase().includes(s));
  return { items, total: s ? items.length : res.count ?? 0, limit, offset };
}

export async function setSubmissionStatus(actor: Actor, ids: number[], status: "unread" | "read" | "spam" | "trash") {
  if (!ids.length) return { updated: 0 };
  must(await sb().from("form_submissions").update({ status }).in("id", ids));
  await audit(actor, "form_submission.status", "form_submission", ids.join(","), null, { status });
  return { updated: ids.length };
}

export function submissionsCsv(rows: any[]) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r.data || {}))));
  const head = ["id", "created_at", "status", "page_url", ...keys];
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // CSV formula injection guard
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [head.map(esc).join(",")];
  for (const r of rows) lines.push([r.id, r.created_at, r.status, r.page_url, ...keys.map((k) => r.data?.[k])].map(esc).join(","));
  return "﻿" + lines.join("\r\n");
}

/* ------------------------------------------------------------- redirects */

export async function listRedirects(opts: { search?: string; kind?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("redirects").select("*", { count: "exact" });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`source_path.ilike.%${s}%,target.ilike.%${s}%`);
  }
  const res = await q.order("id", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function saveRedirect(actor: Actor, id: number | null, input: { source_path: string; target: string; status_code?: number }) {
  let src = (input.source_path || "").trim();
  const target = (input.target || "").trim();
  if (!src.startsWith("/")) {
    try { const u = new URL(src); src = u.pathname + u.search; } catch { throw new AdminError("來源必須是 / 開頭的路徑"); }
  }
  const code = int(input.status_code) ?? 301;
  if (![301, 302, 307, 308, 410].includes(code)) throw new AdminError("狀態碼只能是 301/302/307/308/410");
  if (!target && code !== 410) throw new AdminError("目標不可為空");
  if (target === src) throw new AdminError("來源與目標相同");
  const row = { source_path: src, target: target || "", status_code: code, kind: "manual" };
  let saved: any;
  let before: any = null;
  if (id) {
    before = must(await sb().from("redirects").select("*").eq("id", id).maybeSingle());
    saved = must(await sb().from("redirects").update(row).eq("id", id).select("*").single());
  } else {
    saved = must(await sb().from("redirects").upsert(row, { onConflict: "source_path" }).select("*").single());
  }
  await audit(actor, id ? "redirect.update" : "redirect.create", "redirect", saved.id, before, saved);
  return saved;
}

export async function deleteRedirect(actor: Actor, id: number) {
  const before = must(await sb().from("redirects").select("*").eq("id", id).maybeSingle());
  if (!before) throw new AdminError(`找不到轉址 ${id}`, 404);
  must(await sb().from("redirects").delete().eq("id", id));
  await audit(actor, "redirect.delete", "redirect", id, before, null);
  return { id, deleted: true };
}

/* ------------------------------------------------------------- audit log */

export async function listAudit(opts: { actor_type?: string; entity_type?: string; search?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("audit_log").select("*", { count: "exact" });
  if (opts.actor_type) q = q.eq("actor_type", opts.actor_type);
  if (opts.entity_type) q = q.eq("entity_type", opts.entity_type);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`action.ilike.%${s}%,actor.ilike.%${s}%,entity_id.eq.${s}`);
  }
  const res = await q.order("id", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

/* ------------------------------------------------------------- dashboard */

export async function dashboardCounts() {
  const c = async (table: string, f?: (q: any) => any) => {
    let q = sb().from(table).select("*", { count: "exact", head: true });
    if (f) q = f(q);
    const { count } = await q;
    return count || 0;
  };
  const [posts, pages, products, media, orders, pendingOrders, customers, coupons, unread, redirects] = await Promise.all([
    c("posts", (q) => q.eq("post_type", "post").neq("status", "trash")),
    c("posts", (q) => q.eq("post_type", "page").neq("status", "trash")),
    c("posts", (q) => q.eq("post_type", "product").neq("status", "trash")),
    c("media"),
    c("orders", (q) => q.neq("status", "trash")),
    c("orders", (q) => q.in("status", ["pending", "processing", "on-hold"])),
    c("customers"),
    c("coupons"),
    c("form_submissions", (q) => q.eq("status", "unread")),
    c("redirects"),
  ]);
  return { posts, pages, products, media, orders, pendingOrders, customers, coupons, unreadSubmissions: unread, redirects };
}

/* -------------------------------------------------------------- comments */

export async function listComments(opts: { status?: string; post_id?: number; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("comments").select("id,post_id,parent_id,author_name,author_url,content,status,type,rating,created_at,posts(title,path),comment_private(author_email,author_ip)", { count: "exact" });
  if (opts.status && opts.status !== "any") q = q.eq("status", opts.status);
  else q = q.neq("status", "trash");
  if (opts.post_id) q = q.eq("post_id", opts.post_id);
  const res = await q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function setCommentStatus(actor: Actor, ids: number[], status: "approved" | "hold" | "spam" | "trash") {
  if (!ids.length) return { updated: 0 };
  must(await sb().from("comments").update({ status }).in("id", ids));
  await audit(actor, "comment.status", "comment", ids.join(","), null, { status });
  refreshSite();
  return { updated: ids.length };
}

export async function deleteComments(actor: Actor, ids: number[]) {
  if (!ids.length) return { deleted: 0 };
  const before = must(await sb().from("comments").select("*").in("id", ids));
  must(await sb().from("comments").delete().in("id", ids));
  await audit(actor, "comment.delete", "comment", ids.join(","), before, null);
  refreshSite();
  return { deleted: ids.length };
}
