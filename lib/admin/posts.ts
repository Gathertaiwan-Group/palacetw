import "server-only";
import { AdminError, type Actor, audit, must, refreshSite, sb, slugify, taipeiLocal, int } from "./core";

export const POST_TYPES = ["post", "page", "product", "ocean_modal_window"] as const;
export const STATUSES = ["publish", "draft", "pending", "private", "future", "trash"] as const;
export type PostStatus = (typeof STATUSES)[number];

/** Taxonomies attached to each post type */
export const TYPE_TAXONOMIES: Record<string, { cat: string; tag: string }> = {
  post: { cat: "category", tag: "post_tag" },
  product: { cat: "product_cat", tag: "product_tag" },
};

export type PostInput = {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  status?: PostStatus;
  date?: string | null; // ISO; required for status=future
  author_id?: number | null;
  parent_id?: number | null;
  menu_order?: number;
  comment_status?: "open" | "closed";
  featured_media_id?: number | null;
  category_ids?: number[];
  tag_ids?: number[];
  seo_title?: string | null;
  seo_description?: string | null;
  template?: string;
};

const LIST_COLS = "id,post_type,status,slug,path,title,author_id,published_at,date_local,modified_at,featured_media_id,parent_id,menu_order";

export async function listPosts(opts: { type?: string; status?: string; search?: string; limit?: number; offset?: number; category_id?: number }) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  let q = sb().from("posts").select(LIST_COLS, { count: "exact" });
  if (opts.type) q = q.eq("post_type", opts.type);
  if (opts.status && opts.status !== "any") q = q.eq("status", opts.status);
  else q = q.neq("status", "trash");
  if (opts.search) {
    const s = opts.search.replace(/[%,()]/g, " ").trim();
    if (s) q = q.or(`title.ilike.%${s}%,slug.ilike.%${encodeURIComponent(s).toLowerCase()}%,content.ilike.%${s}%`);
  }
  if (opts.category_id) {
    const rels = must(await sb().from("term_relationships").select("object_id").eq("term_id", opts.category_id));
    q = q.in("id", (rels || []).map((r: any) => r.object_id).concat([-1]));
  }
  const res = await q.order("published_at", { ascending: false, nullsFirst: true }).order("id", { ascending: false }).range(offset, offset + limit - 1);
  if (res.error) throw new AdminError(res.error.message, 500);
  return { items: res.data || [], total: res.count ?? 0, limit, offset };
}

export async function statusCounts(type: string) {
  const out: Record<string, number> = {};
  await Promise.all(
    STATUSES.map(async (st) => {
      const { count } = await sb().from("posts").select("id", { count: "exact", head: true }).eq("post_type", type).eq("status", st);
      out[st] = count || 0;
    }),
  );
  return out;
}

export async function getPost(id: number) {
  const post = must(await sb().from("posts").select("*").eq("id", id).maybeSingle());
  if (!post) throw new AdminError(`找不到 ID ${id}`, 404);
  const rels = must(await sb().from("term_relationships").select("term_id, terms(id,taxonomy,name,slug)").eq("object_id", id)) as any[];
  const terms = rels.map((r) => r.terms).filter(Boolean);
  return { ...post, terms };
}

async function uniqueSlug(type: string, base: string, exceptId?: number) {
  let slug = base || "post";
  for (let i = 2; i < 200; i++) {
    let q = sb().from("posts").select("id").eq("post_type", type).eq("slug", slug);
    if (exceptId) q = q.neq("id", exceptId);
    const { data } = await q.limit(1);
    if (!data?.length) return slug;
    slug = `${base}-${i}`;
  }
  throw new AdminError("無法產生唯一網址代稱");
}

async function pathFor(type: string, slug: string, parentId: number | null) {
  if (type === "product") return `/product/${slug}/`;
  if (type === "page" && parentId) {
    const { data } = await sb().from("posts").select("path,slug").eq("id", parentId).maybeSingle();
    if (data) return `${(data.path || `/${data.slug}/`).replace(/\/$/, "")}/${slug}/`;
  }
  if (type === "post" || type === "page") return `/${slug}/`;
  return null; // ocean_modal_window etc. have no public URL
}

async function setTerms(postId: number, type: string, kind: "cat" | "tag", ids: number[]) {
  const tax = TYPE_TAXONOMIES[type]?.[kind];
  if (!tax) return;
  const clean = Array.from(new Set(ids.map(Number).filter((n) => Number.isFinite(n))));
  if (clean.length) {
    const ok = must(await sb().from("terms").select("id").eq("taxonomy", tax).in("id", clean)) as any[];
    if (ok.length !== clean.length) throw new AdminError(`${tax} 的 ID 不存在：${clean.filter((c) => !ok.some((o) => o.id === c)).join(",")}`);
  }
  const current = must(await sb().from("term_relationships").select("term_id, terms!inner(taxonomy)").eq("object_id", postId).eq("terms.taxonomy", tax)) as any[];
  const del = current.map((c) => c.term_id).filter((t) => !clean.includes(t));
  if (del.length) must(await sb().from("term_relationships").delete().eq("object_id", postId).in("term_id", del));
  const add = clean.filter((t) => !current.some((c) => c.term_id === t));
  if (add.length) must(await sb().from("term_relationships").insert(add.map((term_id, i) => ({ object_id: postId, term_id, term_order: i }))));
}

function resolveStatusDate(status: PostStatus | undefined, date: string | null | undefined, existing?: { status: string; published_at: string | null }) {
  let st = status ?? (existing?.status as PostStatus) ?? "draft";
  let when: string | null | undefined = date === undefined ? undefined : date ? new Date(date).toISOString() : null;
  if (when && Number.isNaN(Date.parse(when))) throw new AdminError("日期格式錯誤");
  const now = Date.now();
  if (st === "future") {
    const t = when ?? existing?.published_at ?? null;
    if (!t) throw new AdminError("排程發布需要指定日期時間");
    if (Date.parse(t) <= now) st = "publish";
    when = t;
  } else if (st === "publish") {
    if (when && Date.parse(when) > now + 60_000) st = "future"; // WordPress: publish with a future date = scheduled
    // publish now: no date given and none stored yet, or the stored date is a (cleared) future schedule
    if (!when && (!existing?.published_at || (existing.status === "future" && date === null))) when = new Date().toISOString();
  }
  return { status: st, published_at: when };
}

async function recount() {
  await sb().rpc("recount_terms");
}

export async function createPost(actor: Actor, type: string, input: PostInput) {
  if (!POST_TYPES.includes(type as any)) throw new AdminError(`不支援的內容類型 ${type}`);
  const title = (input.title ?? "").trim();
  const base = slugify(input.slug || title) || `${type}-${Date.now()}`;
  const slug = await uniqueSlug(type, base);
  const { status, published_at } = resolveStatusDate(input.status ?? "draft", input.date);
  const seo: Record<string, unknown> = {};
  if (input.seo_title) { seo.title = input.seo_title; seo.og_title = input.seo_title; }
  if (input.seo_description) { seo.description = input.seo_description; seo.og_description = input.seo_description; }
  const row = {
    post_type: type,
    status,
    slug,
    path: await pathFor(type, slug, input.parent_id ?? null),
    title,
    content: input.content ?? "",
    excerpt: input.excerpt ?? "",
    author_id: input.author_id ?? null,
    parent_id: input.parent_id ?? null,
    menu_order: input.menu_order ?? 0,
    comment_status: input.comment_status ?? (type === "post" ? "open" : "closed"),
    featured_media_id: input.featured_media_id ?? null,
    template: input.template ?? "",
    published_at: published_at ?? null,
    date_local: published_at ? taipeiLocal(published_at) : null,
    modified_at: new Date().toISOString(),
    seo,
  };
  const created = must(await sb().from("posts").insert(row).select("*").single()) as any;
  if (input.category_ids) await setTerms(created.id, type, "cat", input.category_ids);
  if (input.tag_ids) await setTerms(created.id, type, "tag", input.tag_ids);
  if (type === "product") must(await sb().from("products").insert({ post_id: created.id }));
  await recount();
  await audit(actor, `${type}.create`, type, created.id, null, { ...row, content: undefined, content_length: row.content.length });
  refreshSite();
  return getPost(created.id);
}

export async function updatePost(actor: Actor, id: number, input: PostInput) {
  const before = await getPost(id);
  const type = before.post_type as string;
  const patch: Record<string, unknown> = { modified_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.content !== undefined) patch.content = input.content;
  if (input.excerpt !== undefined) patch.excerpt = input.excerpt;
  if (input.author_id !== undefined) patch.author_id = input.author_id;
  if (input.parent_id !== undefined) {
    if (input.parent_id === id) throw new AdminError("上層不能是自己");
    patch.parent_id = input.parent_id;
  }
  if (input.menu_order !== undefined) patch.menu_order = int(input.menu_order) ?? 0;
  if (input.comment_status !== undefined) patch.comment_status = input.comment_status;
  if (input.featured_media_id !== undefined) patch.featured_media_id = input.featured_media_id;
  if (input.template !== undefined) patch.template = input.template;
  if (input.status !== undefined || input.date !== undefined) {
    const r = resolveStatusDate(input.status, input.date, before);
    patch.status = r.status;
    if (r.published_at !== undefined) {
      patch.published_at = r.published_at;
      patch.date_local = r.published_at ? taipeiLocal(r.published_at) : null;
    }
  }
  if (input.slug !== undefined && input.slug !== before.slug) {
    const s = slugify(input.slug);
    if (!s) throw new AdminError("網址代稱不可為空");
    patch.slug = await uniqueSlug(type, s, id);
  }
  if (patch.slug !== undefined || input.parent_id !== undefined) {
    patch.path = await pathFor(type, (patch.slug as string) ?? before.slug, (patch.parent_id as number | null | undefined) ?? before.parent_id);
  }
  if (input.seo_title !== undefined || input.seo_description !== undefined) {
    const seo = { ...(before.seo || {}) } as Record<string, unknown>;
    if (input.seo_title !== undefined) {
      if (input.seo_title) { seo.title = input.seo_title; seo.og_title = input.seo_title; } else { delete seo.title; delete seo.og_title; }
    }
    if (input.seo_description !== undefined) {
      if (input.seo_description) { seo.description = input.seo_description; seo.og_description = input.seo_description; } else { delete seo.description; delete seo.og_description; }
    }
    patch.seo = seo;
  }
  must(await sb().from("posts").update(patch).eq("id", id));
  if (input.category_ids) await setTerms(id, type, "cat", input.category_ids);
  if (input.tag_ids) await setTerms(id, type, "tag", input.tag_ids);
  // keep the old URL alive (SEO): published content whose path changed gets a 301 from the old path
  if (patch.path !== undefined && before.path && patch.path && patch.path !== before.path && before.status === "publish") {
    await sb().from("redirects").upsert({ source_path: before.path, target: patch.path as string, status_code: 301, kind: "slug-change" }, { onConflict: "source_path" });
  }
  await recount();
  const after = await getPost(id);
  const slim = (p: any) => ({ ...p, content: undefined, content_length: (p.content || "").length, terms: (p.terms || []).map((t: any) => t.id) });
  await audit(actor, `${type}.update`, type, id, slim(before), slim(after));
  refreshSite();
  return after;
}

/** WordPress semantics: delete = move to trash; force = permanent delete. */
export async function deletePost(actor: Actor, id: number, force = false) {
  const before = await getPost(id);
  if (!force && before.status !== "trash") {
    must(await sb().from("posts").update({ status: "trash", meta: { ...(before.meta || {}), _wp_trash_meta_status: before.status }, modified_at: new Date().toISOString() }).eq("id", id));
    await recount();
    await audit(actor, `${before.post_type}.trash`, before.post_type, id, { status: before.status }, { status: "trash" });
    refreshSite();
    return { id, trashed: true };
  }
  must(await sb().from("posts").delete().eq("id", id));
  await recount();
  await audit(actor, `${before.post_type}.delete`, before.post_type, id, { ...before, content: undefined, content_length: (before.content || "").length }, null);
  refreshSite();
  return { id, deleted: true };
}

export async function restorePost(actor: Actor, id: number) {
  const before = await getPost(id);
  const prev = (before.meta?._wp_trash_meta_status as string) || "draft";
  const meta = { ...(before.meta || {}) };
  delete meta._wp_trash_meta_status;
  must(await sb().from("posts").update({ status: prev, meta }).eq("id", id));
  await recount();
  await audit(actor, `${before.post_type}.restore`, before.post_type, id, { status: "trash" }, { status: prev });
  refreshSite();
  return getPost(id);
}

export async function publishDue() {
  const { data } = await sb().rpc("publish_due");
  if (data) refreshSite();
  return (data as number) || 0;
}

export async function authors() {
  return (must(await sb().from("authors").select("id,display_name,slug").order("id")) as any[]) || [];
}
