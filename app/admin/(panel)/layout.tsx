import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/admin/guard";
import { logoutAction } from "../auth-actions";
import Nav from "./Nav";

export default async function Panel({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <div className="adm">
      <aside className="adm-side">
        <Link href="/admin/" className="brand">台灣宮廷酒廠</Link>
        <Suspense fallback={null}><Nav /></Suspense>
      </aside>
      <div className="adm-main">
        <div className="adm-top">
          <a href="/" target="_blank" rel="noreferrer">檢視網站 ↗</a>
          <span>{me.email}（{me.role}）</span>
          <form action={logoutAction}><button type="submit">登出</button></form>
        </div>
        <div className="adm-wrap">{children}</div>
      </div>
    </div>
  );
}
