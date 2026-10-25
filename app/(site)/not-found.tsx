import type { Metadata } from "next";
import { NotFoundView } from "@/components/views/content";

export const metadata: Metadata = { title: "Page Not Found - 台灣宮廷酒廠", robots: "noindex, follow" };

export default function NotFound() {
  return <NotFoundView />;
}
