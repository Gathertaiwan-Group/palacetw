import { redirect } from "next/navigation";
import PostEditor from "@/components/admin/PostEditor";
import { Notice, one, type SP } from "@/components/admin/ui";
import { editorData } from "../editor-data";

const TYPE_LABEL: Record<string, string> = { post: "文章", page: "頁面", ocean_modal_window: "彈出視窗" };
export const metadata = { title: "新增" };

export default async function NewPost({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const type = one(sp.type) || "post";
  if (type === "product") redirect("/admin/products/new/");
  if (!TYPE_LABEL[type]) redirect("/admin/posts/");
  const d = await editorData(type, null);
  return (
    <>
      <h1>新增{TYPE_LABEL[type]}</h1>
      <Notice sp={sp} />
      <PostEditor post={null} type={type} typeLabel={TYPE_LABEL[type]} cats={d.cats} tags={d.tags} featuredUrl={null} parents={d.parents} listHref={`/admin/posts/?type=${type}`} catLabel="分類" tagLabel="標籤" />
    </>
  );
}
