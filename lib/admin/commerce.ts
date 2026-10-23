import "server-only";
import { AdminError, type Actor, audit, must, refreshSite, sb, num, int } from "./core";

export const ORDER_STATUSES: Record<string, string> = {
  pending: "待付款",
  processing: "處理中",
  "on-hold": "保留",
  completed: "已完成",
  cancelled: "已取消",
  refunded: "已退款",
  failed: "失敗",
  "checkout-draft": "草稿",
  trash: "回收桶",
};
const REDUCES = ["processing", "on-hold", "completed"];
const RESTORES = ["cancelled", "refunded", "failed", "pending", "trash"];

/* ---------------------------------------------------------------- orders */

export async function listOrders(opts: { status?: string; search?: string; customer_id?: number; limit?: number; offset?: number; from?: string; to?: string }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("orders").select("id,order_number,status,currency,total,billing,payment_method_title,customer_id,date_created,date_paid", { count: "exact" });
  if (opts.status && opts.status !== "any") q = q.eq("status", opts.status);
  else q = q.neq("status", "trash");
  if (opts.customer_id) q = q.eq("customer_id", opts.customer_id);
  if (opts.from) q = q.gte("date_created", opts.from);
  if (opts.to) q = q.lte("date_created", opts.to);
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (/^\d+$/.test(s)) q = q.or(`id.eq.${s},order_number.eq.${s}`);
    else if (s) q = q.or(`billing->>email.ilike.%${s}%,billing->>first_name.ilike.%${s}%,billing->>last_name.ilike.%${s}%,billing->>phone.ilike.%${s}%`);
  }
  const res = await q.order("date_created", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function orderStatusCounts() {
  const out: Record<string, number> = {};
  await Promise.all(Object.keys(ORDER_STATUSES).map(async (st) => {
    const { count } = await sb().from("orders").select("id", { count: "exact", head: true }).eq("status", st);
    out[st] = count || 0;
  }));
  return out;
}

export async function getOrder(id: number) {
  const order = must(await sb().from("orders").select("*").eq("id", id).maybeSingle()) as any;
  if (!order) throw new AdminError(`找不到訂單 ${id}`, 404);
  const [items, notes, refunds, customer] = await Promise.all([
    sb().from("order_items").select("*").eq("order_id", id).order("id"),
    sb().from("order_notes").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    sb().from("order_refunds").select("*").eq("order_id", id).order("created_at"),
    order.customer_id ? sb().from("customers").select("id,email,display_name,first_name,last_name").eq("id", order.customer_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { ...order, items: items.data || [], notes: notes.data || [], refunds: refunds.data || [], customer: customer.data };
}

async function adjustStock(order: any, direction: -1 | 1) {
  const items = (order.items as any[]).filter((i) => i.item_type === "line_item" && (i.product_id || i.variation_id));
  const changes: unknown[] = [];
  for (const it of items) {
    const table = it.variation_id ? "product_variations" : "products";
    const key = it.variation_id ? "id" : "post_id";
    const id = it.variation_id ?? it.product_id;
    const { data: row } = await sb().from(table).select("manage_stock,stock_quantity,backorders").eq(key, id).maybeSingle();
    if (!row?.manage_stock) continue;
    const q = (row.stock_quantity ?? 0) + direction * it.quantity;
    const stock_status = q > 0 ? "instock" : row.backorders && row.backorders !== "no" ? "onbackorder" : "outofstock";
    await sb().from(table).update({ stock_quantity: q, stock_status }).eq(key, id);
    changes.push({ [table]: id, from: row.stock_quantity, to: q });
  }
  return changes;
}

export async function updateOrderStatus(actor: Actor, id: number, status: string, note?: string) {
  if (!ORDER_STATUSES[status]) throw new AdminError(`不支援的訂單狀態 ${status}`);
  const order = await getOrder(id);
  if (order.status === status && !note) return order;
  const patch: Record<string, unknown> = { status, date_modified: new Date().toISOString() };
  const meta = { ...(order.meta || {}) };
  let stock: unknown[] = [];
  if (REDUCES.includes(status) && !meta._order_stock_reduced) { stock = await adjustStock(order, -1); meta._order_stock_reduced = true; }
  if (RESTORES.includes(status) && meta._order_stock_reduced) { stock = await adjustStock(order, 1); meta._order_stock_reduced = false; }
  patch.meta = meta;
  if (status === "completed" && !order.date_completed) patch.date_completed = new Date().toISOString();
  if ((status === "processing" || status === "completed") && !order.date_paid) patch.date_paid = new Date().toISOString();
  must(await sb().from("orders").update(patch).eq("id", id));
  if (order.status !== status) {
    await sb().from("order_notes").insert({ order_id: id, content: `訂單狀態由「${ORDER_STATUSES[order.status] || order.status}」變更為「${ORDER_STATUSES[status]}」。`, added_by: actor.email });
  }
  if (note) await sb().from("order_notes").insert({ order_id: id, content: note, added_by: actor.email });
  await audit(actor, "order.status", "order", id, { status: order.status }, { status, note: note || null, stock });
  if (stock.length) refreshSite();
  return getOrder(id);
}

export async function addOrderNote(actor: Actor, id: number, content: string, isCustomerNote = false) {
  if (!content.trim()) throw new AdminError("備註不可為空");
  await getOrder(id);
  const row = must(await sb().from("order_notes").insert({ order_id: id, content: content.trim(), is_customer_note: isCustomerNote, added_by: actor.email }).select("*").single());
  await audit(actor, "order.note", "order", id, null, row);
  return row;
}

export async function updateOrderAddress(actor: Actor, id: number, kind: "billing" | "shipping", addr: Record<string, string>) {
  const order = await getOrder(id);
  const next = { ...(order[kind] || {}), ...addr };
  must(await sb().from("orders").update({ [kind]: next, date_modified: new Date().toISOString() }).eq("id", id));
  await audit(actor, `order.${kind}`, "order", id, order[kind], next);
  return getOrder(id);
}

/* ------------------------------------------------------------- customers */

export async function listCustomers(opts: { search?: string; limit?: number; offset?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("customers").select("id,email,username,first_name,last_name,display_name,billing,is_paying_customer,date_registered,last_active", { count: "exact" });
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,display_name.ilike.%${s}%,username.ilike.%${s}%`);
  }
  const res = await q.order("date_registered", { ascending: false, nullsFirst: false }).order("id", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function getCustomer(id: number) {
  const c = must(await sb().from("customers").select("*").eq("id", id).maybeSingle()) as any;
  if (!c) throw new AdminError(`找不到顧客 ${id}`, 404);
  const { data: orders } = await sb().from("orders").select("id,status,total,date_created").eq("customer_id", id).order("date_created", { ascending: false }).limit(100);
  return { ...c, orders: orders || [] };
}

export async function updateCustomer(actor: Actor, id: number, input: { first_name?: string; last_name?: string; display_name?: string; billing?: Record<string, string>; shipping?: Record<string, string> }) {
  const before = await getCustomer(id);
  const patch: Record<string, unknown> = {};
  for (const k of ["first_name", "last_name", "display_name"] as const) if (input[k] !== undefined) patch[k] = input[k];
  if (input.billing) patch.billing = { ...(before.billing || {}), ...input.billing };
  if (input.shipping) patch.shipping = { ...(before.shipping || {}), ...input.shipping };
  const after = must(await sb().from("customers").update(patch).eq("id", id).select("*").single());
  await audit(actor, "customer.update", "customer", id, { first_name: before.first_name, last_name: before.last_name, display_name: before.display_name, billing: before.billing, shipping: before.shipping }, patch);
  return after;
}

/* --------------------------------------------------------------- coupons */

export type CouponInput = {
  code?: string; description?: string; discount_type?: "percent" | "fixed_cart" | "fixed_product"; amount?: number; date_expires?: string | null;
  status?: string; individual_use?: boolean; free_shipping?: boolean; exclude_sale_items?: boolean; minimum_amount?: number | null; maximum_amount?: number | null;
  usage_limit?: number | null; usage_limit_per_user?: number | null; limit_usage_to_x_items?: number | null; product_ids?: number[]; excluded_product_ids?: number[];
  product_categories?: number[]; excluded_product_categories?: number[]; email_restrictions?: string[];
};

export async function listCoupons() {
  return (must(await sb().from("coupons").select("*").neq("status", "trash").order("created_at", { ascending: false })) as any[]) || [];
}

export async function getCoupon(id: number) {
  const c = must(await sb().from("coupons").select("*").eq("id", id).maybeSingle());
  if (!c) throw new AdminError(`找不到優惠券 ${id}`, 404);
  return c as any;
}

export async function saveCoupon(actor: Actor, id: number | null, input: CouponInput) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) patch[k] = v;
  if (patch.code !== undefined) {
    const code = String(patch.code).trim().toLowerCase();
    if (!code) throw new AdminError("優惠碼不可為空");
    let dq = sb().from("coupons").select("id").ilike("code", code);
    if (id) dq = dq.neq("id", id);
    const { data: dup } = await dq.limit(1);
    if (dup?.length) throw new AdminError(`優惠碼 ${code} 已存在`);
    patch.code = code;
  }
  for (const k of ["amount", "minimum_amount", "maximum_amount"]) if (k in patch) patch[k] = num(patch[k]) ?? (k === "amount" ? 0 : null);
  for (const k of ["usage_limit", "usage_limit_per_user", "limit_usage_to_x_items"]) if (k in patch) patch[k] = int(patch[k]);
  if (patch.discount_type === "percent" && Number(patch.amount ?? 0) > 100) throw new AdminError("百分比折扣不可超過 100");
  let before: any = null;
  let row: any;
  if (id) {
    before = await getCoupon(id);
    row = must(await sb().from("coupons").update(patch).eq("id", id).select("*").single());
  } else {
    if (!patch.code) throw new AdminError("優惠碼不可為空");
    row = must(await sb().from("coupons").insert(patch).select("*").single());
  }
  await audit(actor, id ? "coupon.update" : "coupon.create", "coupon", row.id, before, row);
  return row;
}

export async function deleteCoupon(actor: Actor, id: number) {
  const before = await getCoupon(id);
  must(await sb().from("coupons").delete().eq("id", id));
  await audit(actor, "coupon.delete", "coupon", id, before, null);
  return { id, deleted: true };
}

/* ------------------------------------------------ quantity discount rules */

export type RuleInput = { name?: string; scope?: "all" | "product" | "variation" | "product_cat"; product_id?: number | null; variation_id?: number | null; term_id?: number | null; min_qty?: number; max_qty?: number | null; discount_type?: "percent" | "fixed_amount" | "fixed_price"; amount?: number; priority?: number; active?: boolean; starts_at?: string | null; ends_at?: string | null };

export async function listRules() {
  return (must(await sb().from("quantity_discount_rules").select("*").order("priority").order("min_qty")) as any[]) || [];
}

export async function saveRule(actor: Actor, id: number | null, input: RuleInput) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) if (v !== undefined) patch[k] = v;
  for (const k of ["product_id", "variation_id", "term_id", "max_qty"]) if (k in patch) patch[k] = int(patch[k]);
  if ("min_qty" in patch) patch.min_qty = Math.max(1, int(patch.min_qty) ?? 1);
  if ("amount" in patch) patch.amount = num(patch.amount) ?? 0;
  if ("priority" in patch) patch.priority = int(patch.priority) ?? 10;
  const scope = (patch.scope as string) ?? undefined;
  if (scope === "product" && !patch.product_id) throw new AdminError("範圍為商品時需指定商品 ID");
  if (scope === "product_cat" && !patch.term_id) throw new AdminError("範圍為商品分類時需指定分類 ID");
  if (scope === "variation" && !patch.variation_id) throw new AdminError("範圍為變體時需指定變體 ID");
  let before: any = null;
  let row: any;
  if (id) {
    before = must(await sb().from("quantity_discount_rules").select("*").eq("id", id).maybeSingle());
    if (!before) throw new AdminError(`找不到折扣規則 ${id}`, 404);
    row = must(await sb().from("quantity_discount_rules").update(patch).eq("id", id).select("*").single());
  } else {
    if (!patch.name || !patch.discount_type) throw new AdminError("名稱與折扣方式為必填");
    row = must(await sb().from("quantity_discount_rules").insert(patch).select("*").single());
  }
  await audit(actor, id ? "discount_rule.update" : "discount_rule.create", "discount_rule", row.id, before, row);
  refreshSite();
  return row;
}

export async function deleteRule(actor: Actor, id: number) {
  const before = must(await sb().from("quantity_discount_rules").select("*").eq("id", id).maybeSingle());
  if (!before) throw new AdminError(`找不到折扣規則 ${id}`, 404);
  must(await sb().from("quantity_discount_rules").delete().eq("id", id));
  await audit(actor, "discount_rule.delete", "discount_rule", id, before, null);
  refreshSite();
  return { id, deleted: true };
}
