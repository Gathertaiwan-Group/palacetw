import { NextResponse } from "next/server";
import { getIndex, link, mediaById, priceInfo, productOf, termsOf, termLink } from "@/lib/data";

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  const ix = await getIndex();
  const post = ix.posts.find((p) => p.id === id && p.post_type === "product" && p.status === "publish");
  const prod = productOf(ix, id);
  if (!post || !prod) return NextResponse.json({ error: "not found" }, { status: 404 });
  const img = mediaById(ix, post.featured_media_id);
  const gallery = [img, ...prod.gallery_image_ids.map((g) => mediaById(ix, g))].filter(Boolean).map((m) => ({ src: m!.public_url, alt: m!.alt_text || post.title }));
  const pi = priceInfo(prod);
  return NextResponse.json({
    id, title: post.title, link: link(post), images: gallery, short_description: prod.short_description, sku: prod.sku,
    price: pi, stock_status: prod.stock_status,
    categories: termsOf(ix, id, "product_cat").map((t) => ({ name: t.name, link: termLink(t) })),
  });
}
