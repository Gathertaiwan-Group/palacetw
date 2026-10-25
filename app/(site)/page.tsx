import type { Metadata } from "next";
import { homeMetadata, renderHome } from "@/lib/render";

// ISR: rebuilt at most every 300 s and immediately after admin / MCP writes (revalidateTag("site")).
// Searches (/?s=…) are rewritten by proxy.ts to the per-request renderer in ./dyn-render.
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return homeMetadata({});
}

export default async function Home() {
  return renderHome({});
}
