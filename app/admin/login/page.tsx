import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/admin/guard";
import { loginAction } from "../auth-actions";

export const metadata = { title: "登入" };

export default async function Login({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const sp = await searchParams;
  if (await getAdmin()) redirect("/admin/");
  return (
    <div className="adm" style={{ display: "block" }}>
      <div className="login">
        <h1 style={{ justifyContent: "center" }}>台灣宮廷酒廠 後台</h1>
        {sp.err ? <div className="notice err">{sp.err}</div> : null}
        <form action={loginAction} className="card">
          <input type="hidden" name="next" value={sp.next || "/admin/"} />
          <label htmlFor="email">電子郵件</label>
          <input id="email" name="email" type="email" required autoComplete="username" />
          <label htmlFor="password">密碼</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
          <div className="actions"><button className="btn btn-p" type="submit">登入</button></div>
        </form>
        <p className="muted" style={{ textAlign: "center" }}><a href="/">← 回到網站</a></p>
      </div>
    </div>
  );
}
