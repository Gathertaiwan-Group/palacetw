"use server";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import { audit } from "@/lib/admin/core";

export async function loginAction(fd: FormData) {
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");
  const nextRaw = String(fd.get("next") || "/admin/");
  const next = nextRaw.startsWith("/admin") ? nextRaw : "/admin/";
  const sb = await authClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect("/admin/login/?err=" + encodeURIComponent("電子郵件或密碼錯誤"));
  const { data: row } = await admin().from("admins").select("email").eq("user_id", data.user.id).maybeSingle();
  if (!row) {
    await sb.auth.signOut();
    redirect("/admin/login/?err=" + encodeURIComponent("此帳號沒有本站後台權限"));
  }
  await audit({ email: row.email, type: "admin" }, "admin.login", "admin", data.user.id);
  redirect(next);
}

export async function logoutAction() {
  const sb = await authClient();
  await sb.auth.signOut();
  redirect("/admin/login/");
}
