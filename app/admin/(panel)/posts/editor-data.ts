import "server-only";
import { listTerms } from "@/lib/admin/terms";
import { sb } from "@/lib/admin/core";

export async function editorData(type: string, featuredId: number | null) {
  const tax = type === "product" ? ["product_cat", "product_tag"] : type === "post" ? ["category", "post_tag"] : null;
  const [cats, tags, featured, parents] = await Promise.all([
    tax ? listTerms(tax[0]) : Promise.resolve([]),
    tax ? listTerms(tax[1]) : Promise.resolve([]),
    featuredId ? sb().from("media").select("public_url").eq("id", featuredId).maybeSingle() : Promise.resolve({ data: null }),
    type === "page" ? sb().from("posts").select("id,title").eq("post_type", "page").neq("status", "trash").order("title") : Promise.resolve({ data: [] }),
  ]);
  return { cats, tags, featuredUrl: (featured.data as any)?.public_url ?? null, parents: (parents.data as any[]) || [] };
}
