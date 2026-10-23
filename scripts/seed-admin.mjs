// Create the seed administrator admin+palacetw@gathertaiwan.com (Supabase Auth, email confirmed) and register it
// in site_palacetw.admins. The random password is appended to ~/.config/gather-migrate/env as ADMIN_PW_PALACETW
// and is never printed. Usage: source ~/.config/gather-migrate/env && node scripts/seed-admin.mjs
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { appendFileSync } from "node:fs";
import { homedir } from "node:os";

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
const EMAIL = "admin+palacetw@gathertaiwan.com";
const sb = createClient(URL, KEY, { auth: { persistSession: false }, db: { schema: "site_palacetw" } });

const { data: existing } = await sb.from("admins").select("user_id").eq("email", EMAIL).maybeSingle();
if (existing) { console.log("admin already registered:", EMAIL); process.exit(0); }
if (process.env.ADMIN_PW_PALACETW) throw new Error("ADMIN_PW_PALACETW already set but admins row missing — resolve manually");

const pw = randomBytes(24).toString("base64url") + "!aA1";
const { data, error } = await sb.auth.admin.createUser({ email: EMAIL, password: pw, email_confirm: true, user_metadata: { site: "palacetw", role: "administrator" } });
if (error) throw new Error("createUser failed: " + error.message);
appendFileSync(homedir() + "/.config/gather-migrate/env", `export ADMIN_PW_PALACETW='${pw}'\n`);
const { data: author } = await sb.from("authors").select("id").order("id").limit(1).maybeSingle();
const { error: e2 } = await sb.from("admins").insert({ user_id: data.user.id, email: EMAIL, role: "administrator", author_id: author?.id ?? null });
if (e2) throw new Error("admins insert failed: " + e2.message);
console.log("created admin", EMAIL, "user_id", data.user.id, "(password stored in env as ADMIN_PW_PALACETW)");
