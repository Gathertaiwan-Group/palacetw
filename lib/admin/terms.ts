import "server-only";
import { AdminError, type Actor, audit, must, refreshSite, sb, slugify } from "./core";

export const TAXONOMIES: Record<string, string> = {
  category: "文章分類",
  post_tag: "文章標籤",
  product_cat: "商品分類",
  product_tag: "商品標籤",
};

export async function listTerms(taxonomy?: string) {
  let q = sb().from("terms").select("id,taxonomy,name,slug,description,parent_id,count,image_id,term_order");
  if (taxonomy) q = q.eq("taxonomy", taxonomy);
  return (must(await q.order("taxonomy").order("term_order").order("name")) as any[]) || [];
}

export type TermInput = { name?: string; slug?: string; description?: string; parent_id?: number | null; image_id?: number | null; term_order?: number };

export async function createTerm(actor: Actor, taxonomy: string, input: TermInput) {
  if (!TAXONOMIES[taxonomy]) throw new AdminError(`不支援的分類法 ${taxonomy}`);
  const name = (input.name || "").trim();
  if (!name) throw new AdminError("名稱不可為空");
  const slug = slugify(input.slug || name);
  const { data: dup } = await sb().from("terms").select("id").eq("taxonomy", taxonomy).eq("slug", slug).maybeSingle();
  if (dup) throw new AdminError(`代稱 ${decodeURIComponent(slug)} 已存在`);
  const row = must(await sb().from("terms").insert({ taxonomy, name, slug, description: input.description ?? "", parent_id: input.parent_id ?? null, image_id: input.image_id ?? null, term_order: input.term_order ?? 0 }).select("*").single()) as any;
  await audit(actor, `${taxonomy}.create`, "term", row.id, null, row);
  refreshSite();
  return row;
}

export async function updateTerm(actor: Actor, id: number, input: TermInput) {
  const before = must(await sb().from("terms").select("*").eq("id", id).maybeSingle()) as any;
  if (!before) throw new AdminError(`找不到分類 ${id}`, 404);
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.parent_id !== undefined) {
    if (input.parent_id === id) throw new AdminError("上層不能是自己");
    patch.parent_id = input.parent_id;
  }
  if (input.image_id !== undefined) patch.image_id = input.image_id;
  if (input.term_order !== undefined) patch.term_order = input.term_order;
  if (input.slug !== undefined && input.slug !== before.slug) {
    const slug = slugify(input.slug);
    const { data: dup } = await sb().from("terms").select("id").eq("taxonomy", before.taxonomy).eq("slug", slug).neq("id", id).maybeSingle();
    if (dup) throw new AdminError(`代稱 ${decodeURIComponent(slug)} 已存在`);
    patch.slug = slug;
  }
  const after = must(await sb().from("terms").update(patch).eq("id", id).select("*").single()) as any;
  if (patch.slug) {
    const base: Record<string, string> = { category: "category", post_tag: "tag", product_cat: "product-category", product_tag: "product-tag" };
    const b = base[before.taxonomy];
    if (b) await sb().from("redirects").upsert({ source_path: `/${b}/${before.slug}/`, target: `/${b}/${after.slug}/`, status_code: 301, kind: "slug-change" }, { onConflict: "source_path" });
  }
  await audit(actor, `${before.taxonomy}.update`, "term", id, before, after);
  refreshSite();
  return after;
}

export async function deleteTerm(actor: Actor, id: number) {
  const before = must(await sb().from("terms").select("*").eq("id", id).maybeSingle()) as any;
  if (!before) throw new AdminError(`找不到分類 ${id}`, 404);
  must(await sb().from("terms").update({ parent_id: before.parent_id }).eq("parent_id", id));
  must(await sb().from("terms").delete().eq("id", id));
  await audit(actor, `${before.taxonomy}.delete`, "term", id, before, null);
  refreshSite();
  return { id, deleted: true };
}
