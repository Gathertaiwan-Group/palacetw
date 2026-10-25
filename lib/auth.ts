import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { admin } from "./supabase";

export async function authClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => { try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch { /* called from a server component */ } },
    },
  });
}

export async function currentUser() {
  try {
    const sb = await authClient();
    const { data } = await sb.auth.getUser();
    return data.user || null;
  } catch { return null; }
}

/** Find (or create) the site_palacetw.customers row linked to a Supabase auth user. */
export async function customerFor(user: { id: string; email?: string | null }, create = true) {
  const sb = admin();
  // Site administrators are not customers: never link or auto-create a customers row for them
  // (keeps the customer count equal to the imported WooCommerce customers).
  const { data: isAdmin } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (isAdmin) return null;
  const { data } = await sb.from("customers").select("*").eq("auth_user_id", user.id).maybeSingle();
  if (data) return data;
  if (user.email) {
    const { data: byEmail } = await sb.from("customers").select("*").ilike("email", user.email).maybeSingle();
    if (byEmail) {
      if (!byEmail.auth_user_id) await sb.from("customers").update({ auth_user_id: user.id }).eq("id", byEmail.id);
      return byEmail;
    }
  }
  if (!create || !user.email) return null;
  const { data: ins } = await sb.from("customers").insert({ auth_user_id: user.id, email: user.email, username: user.email, display_name: user.email.split("@")[0], date_registered: new Date().toISOString() }).select("*").single();
  return ins;
}
