import { notFound, redirect } from "next/navigation";
import PostEditor from "@/components/admin/PostEditor";
import { Notice, type SP } from "@/components/admin/ui";
import { getPost } from "@/lib/admin/posts";
import { editorData } from "../editor-data";

const TYPE_LABEL: Record<string, string> = { post: "文章", page: "頁面", ocean_modal_window: "彈出視窗" };
export const metadata = { title: "編輯" };

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const post = await getPost(Number(id)).catch(() => null);
  if (!post) notFound();
  if (post.post_type === "product") redirect(`/admin/products/${post.id}/`);
  const d = await editorData(post.post_type, post.featured_media_id);
  const label = TYPE_LABEL[post.post_type] || post.post_type;
  return (
    <>
      <h1>編輯{label}</h1>
      <Notice sp={sp} />
      <PostEditor key={`${post.id}-${post.modified_at}`} post={post} type={post.post_type} typeLabel={label} cats={d.cats} tags={d.tags} featuredUrl={d.featuredUrl} parents={d.parents} listHref={`/admin/posts/?type=${post.post_type}`} />
    </>
  );
}
