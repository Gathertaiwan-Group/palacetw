import PostEditor from "@/components/admin/PostEditor";
import ProductData from "@/components/admin/ProductData";
import { Notice, type SP } from "@/components/admin/ui";
import { editorData } from "../../posts/editor-data";

export const metadata = { title: "新增商品" };

export default async function NewProduct({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const d = await editorData("product", null);
  return (
    <>
      <h1>新增商品</h1>
      <Notice sp={sp} />
      <PostEditor post={null} type="product" typeLabel="商品" cats={d.cats} tags={d.tags} catLabel="商品分類" tagLabel="商品標籤" featuredUrl={null} listHref="/admin/products/">
        <ProductData p={null} gallery={[]} />
      </PostEditor>
    </>
  );
}
