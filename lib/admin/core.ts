import "server-only";
import { revalidateTag } from "next/cache";
import { admin } from "@/lib/supabase";

/** Who performs a write. Every write in the admin / MCP service layer is recorded in site_palacetw.audit_log. */
export type Actor = { email: string; type: "admin" | "mcp" | "system"; ip?: string | null };

export class AdminError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const sb = () => admin();

/** Throw on a Supabase error, return data otherwise. */
export function must<T>(res: { data: T; error: { message: string } | null }, what = "資料庫錯誤"): T {
  if (res.error) throw new AdminError(`${what}：${res.error.message}`, 500);
  return res.data;
}

export async function audit(actor: Actor, action: string, entityType: string | null, entityId: string | number | null, before: unknown = null, after: unknown = null) {
  const ip = actor.ip && /^[0-9a-fA-F:.]+$/.test(actor.ip) ? actor.ip : null;
  const { error } = await sb().from("audit_log").insert({
    actor: actor.email,
    actor_type: actor.type,
    action,
    entity_type: entityType,
    entity_id: entityId === null ? null : String(entityId),
    before: before ?? null,
    after: after ?? null,
    ip,
  });
  if (error) console.error("[audit]", error.message);
}

/** Front-end data is cached under the "site" tag (lib/data.ts); expire it after any content write. */
export function refreshSite() {
  try {
    revalidateTag("site", { expire: 0 });
  } catch {
    /* outside a request scope (scripts) */
  }
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

/** WordPress-style slug: lower-case, spaces to dashes, unicode kept but percent-encoded lower-case. */
export function slugify(input: string) {
  let s = input;
  try { s = decodeURIComponent(input); } catch { /* raw */ }
  s = s.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

export function decodeSlug(s: string) {
  try { return decodeURIComponent(s); } catch { return s; }
}

/** Site local time (Asia/Taipei, UTC+8, no DST) for posts.date_local */
export function taipeiLocal(iso: string) {
  const d = new Date(new Date(iso).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
