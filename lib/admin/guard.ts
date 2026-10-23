import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authClient } from "@/lib/auth";
import { admin } from "@/lib/supabase";
import type { Actor } from "./core";

export type AdminUser = { user_id: string; email: string; role: string };

/** The signed-in Supabase Auth user, only if listed in site_palacetw.admins. */
export async function getAdmin(): Promise<AdminUser | null> {
  try {
    const sbAuth = await authClient();
    const { data } = await sbAuth.auth.getUser();
    if (!data.user) return null;
    const { data: row } = await admin().from("admins").select("user_id,email,role").eq("user_id", data.user.id).maybeSingle();
    return (row as AdminUser) || null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<AdminUser> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login/");
  return a;
}

export async function adminActor(): Promise<Actor> {
  const a = await requireAdmin();
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null;
  return { email: a.email, type: "admin", ip };
}
