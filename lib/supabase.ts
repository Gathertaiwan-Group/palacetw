import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SCHEMA = "site_palacetw";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let anon: SupabaseClient<any, any, any> | null = null;
let service: SupabaseClient<any, any, any> | null = null;

/** Public, RLS-limited reads (published content only). */
export function db() {
  if (!anon) anon = createClient(URL, ANON, { db: { schema: SCHEMA }, auth: { persistSession: false } });
  return anon;
}

/** Server-only writes (orders, carts, form submissions). Never import from client components. */
export function admin() {
  if (typeof window !== "undefined") throw new Error("service client on the client");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  if (!service) service = createClient(URL, key, { db: { schema: SCHEMA }, auth: { persistSession: false } });
  return service;
}
