import type { Metadata } from "next";
import { getIndex, setting } from "@/lib/data";
import { postMetadata, simpleMetadata, JsonLd, postJsonLd } from "@/lib/seo";
import { PageView } from "@/components/views/content";
import { renderSearch } from "@/components/views/search";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function front() {
  const ix = await getIndex();
  const reading = setting<{ page_on_front?: number }>(ix, "reading", {});
  const page = ix.posts.find((p) => p.id === (reading.page_on_front || 396))!;
  return { ix, page };
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  if (typeof sp.s === "string") return simpleMetadata(`${sp.s}`, "noindex, follow");
  const { page } = await front();
  return postMetadata(page);
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  if (typeof sp.s === "string") return renderSearch(sp.s, 1);
  const { ix, page } = await front();
  return <><JsonLd data={postJsonLd(page)} /><PageView ix={ix} page={page} isHome /></>;
}
