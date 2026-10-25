import type { Metadata } from "next";
import { homeMetadata, pathMetadata, renderHome, renderPath } from "@/lib/render";

/**
 * Per-request renderer. Never addressed directly (proxy.ts 404s /dyn-render/…): proxy.ts rewrites to it when a page
 * needs request data — a query string (?s=, ?orderby=, ?key=, ?action=register …) or the cart / checkout / account
 * pages, which read the cart and login cookies.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ path = [] }, sp] = await Promise.all([params, searchParams]);
  return path.length ? pathMetadata(path, "dynamic") : homeMetadata(sp);
}

export default async function Dyn({ params, searchParams }: Props) {
  const [{ path = [] }, sp] = await Promise.all([params, searchParams]);
  return path.length ? renderPath(path, sp, "dynamic") : renderHome(sp);
}
