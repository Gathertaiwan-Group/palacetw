import type { Metadata } from "next";
import { pathMetadata, renderPath } from "@/lib/render";

// ISR: every public URL is rendered on first request, cached, and re-rendered at most every 300 s or right after an
// admin / MCP write (revalidateTag("site") + revalidatePath). Requests with a query string and the cart / checkout /
// my-account pages are rewritten by proxy.ts to ../dyn-render, which renders per request.
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ path: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return pathMetadata((await params).path, "static");
}

export default async function CatchAll({ params }: Props) {
  return renderPath((await params).path, {}, "static");
}
