import type { Metadata } from "next";
import "../globals.css";
import "./admin.css";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: { default: `後台 - ${SITE_NAME}`, template: `%s - ${SITE_NAME} 後台` }, robots: { index: false, follow: false } };

/** Root layout of /admin (separate from the public site's root layout in app/(site), so public pages stay static). */
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="adm-body"><div className="adm-root">{children}</div></body>
    </html>
  );
}
