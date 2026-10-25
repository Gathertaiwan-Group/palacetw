import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function rest(path: string) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: ANON, "Accept-Profile": "site_palacetw" }, cache: "no-store" });
  if (!r.ok) return [];
  return (await r.json()) as any[];
}

async function redirectFor(source: string) {
  const rows = await rest(`redirects?select=target,status_code&source_path=eq.${encodeURIComponent(source)}&limit=1`);
  return rows[0] || null;
}

/** Legacy WordPress URL handling: attachment pages, /wp-content/uploads/ files, ?p= / ?page_id= short links, Rank Math sitemaps. */
export async function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // trailingSlash redirect (Next's built-in one is disabled by skipTrailingSlashRedirect so /api/* isn't redirected).
  // Uses the raw request URL: nextUrl may already be slash-normalised.
  {
    const raw = new URL(req.url);
    const p = raw.pathname;
    if (!p.startsWith("/.well-known")) {
      const last = p.slice(p.lastIndexOf("/") + 1);
      let to: string | null = null;
      if (last && !last.includes(".")) to = p + "/";
      else if (/\/[^/]+\.\w+\/$/.test(p)) to = p.replace(/\/$/, "");
      if (to) return NextResponse.redirect(new URL(to + raw.search, req.url), 308);
    }
  }

  // the dynamic renderer is internal (reached only through the rewrite at the end of this function)
  if (pathname === "/dyn-render" || pathname.startsWith("/dyn-render/")) {
    return NextResponse.redirect(new URL((pathname.slice("/dyn-render".length) || "/") + req.nextUrl.search, req.url), 301);
  }

  // No-JS add-to-cart (WooCommerce's non-AJAX path): the product page <form class="cart" method="post"> posting
  // add-to-cart=ID, or a ?add-to-cart=ID link, is handled by app/api/cart/form (writes cart_items, sets the cart cookie,
  // 303s back with a notice) — so a click before hydration still adds the product.
  if (!pathname.startsWith("/admin") && (req.method === "GET" || req.method === "POST")) {
    let atc = searchParams.get("add-to-cart");
    const ct = req.headers.get("content-type") || "";
    if (req.method === "POST" && !req.headers.has("next-action") && (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data"))) {
      const fd = await req.clone().formData().catch(() => null);
      const v = fd?.get("add-to-cart");
      if (typeof v === "string" && v) atc = v;
    }
    if (atc && /^\d+$/.test(atc)) {
      const u = new URL("/api/cart/form/", req.url);
      const back = new URLSearchParams(searchParams);
      if (req.method === "GET") {
        searchParams.forEach((v, k) => u.searchParams.set(k, v));
        back.delete("add-to-cart"); back.delete("quantity");
      }
      const qs = back.toString();
      u.searchParams.set("return", pathname + (qs ? "?" + qs : ""));
      return NextResponse.rewrite(u);
    }
  }

  // /admin: mark the request (root layout skips the WordPress theme) and refresh the Supabase Auth session cookies.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const next = () => {
      const h = new Headers(req.headers);
      h.set("x-admin-area", "1");
      return NextResponse.next({ request: { headers: h } });
    };
    let res = next();
    const sb = createServerClient(URL_, ANON, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = next();
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    const { data } = await sb.auth.getUser().catch(() => ({ data: { user: null } }));
    // gate every /admin request (pages, RSC navigations, exports) on site_palacetw.admins membership
    if (!pathname.startsWith("/admin/login")) {
      let ok = false;
      if (data.user) {
        const { data: row } = await sb.schema("site_palacetw").from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
        ok = !!row;
      }
      if (!ok) {
        const login = new URL("/admin/login/", req.url);
        if (req.method === "GET") login.searchParams.set("next", pathname + req.nextUrl.search);
        const r = NextResponse.redirect(login, 303);
        res.cookies.getAll().forEach((c) => r.cookies.set(c));
        return r;
      }
    }
    res.headers.set("x-robots-tag", "noindex, nofollow");
    res.headers.set("cache-control", "private, no-store");
    return res;
  }

  // WordPress oEmbed card: /<permalink>/embed/ → rendered by app/api/embed
  const em = pathname.match(/^\/(.+\/)embed\/?$/);
  if (em && !pathname.startsWith("/wp-content/")) {
    const u = new URL("/api/embed/", req.url);
    u.search = "";
    u.searchParams.set("path", "/" + em[1]);
    return NextResponse.rewrite(u);
  }

  // renamed author slugs (e.g. the old e-mail-address slug): 301 the archive and everything under it (/page/N/, /feed/)
  const au = pathname.match(/^\/author\/([^/]+)\/(.*)$/);
  if (au && au[1] !== "admin") {
    const hit = await redirectFor(`/author/${au[1]}/`);
    if (hit?.target) return NextResponse.redirect(new URL(hit.target + au[2] + req.nextUrl.search, req.url), hit.status_code || 301);
  }

  const att = searchParams.get("attachment_id");
  if (att && /^\d+$/.test(att)) {
    const hit = await redirectFor(`/?attachment_id=${att}`);
    if (hit) return NextResponse.redirect(hit.target, hit.status_code || 301);
    const m = await rest(`media?select=public_url&id=eq.${att}&limit=1`);
    if (m[0]?.public_url) return NextResponse.redirect(m[0].public_url, 301);
  }

  if (pathname.startsWith("/wp-content/uploads/")) {
    const hit = await redirectFor(decodeURIComponent(pathname)) || await redirectFor(pathname);
    if (hit) return NextResponse.redirect(hit.target, hit.status_code || 301);
    // size variants (-WxH) and -scaled map to the single stored original
    const old = `https://palacetwshop.com${pathname}`;
    const rows = await rest(`media_url_map?select=new_url&old_url=eq.${encodeURIComponent(old)}&limit=1`);
    if (rows[0]) return NextResponse.redirect(rows[0].new_url, 301);
    return NextResponse.next();
  }

  const pid = searchParams.get("page_id") || searchParams.get("p") || (searchParams.get("post_type") === "product" ? searchParams.get("p") : null);
  if (pid && /^\d+$/.test(pid) && pathname === "/") {
    const rows = await rest(`posts?select=path,post_type&id=eq.${pid}&status=eq.publish&limit=1`);
    if (rows[0]?.path) return NextResponse.redirect(new URL(rows[0].path, req.url), 301);
  }

  if (/^\/(wp-sitemap\.xml|(post_tag|product_tag)-sitemap\d*\.xml)$/.test(pathname)) {
    return NextResponse.redirect(new URL("/sitemap.xml", req.url), 301);
  }
  // Public pages are ISR (app/(site)/page.tsx, app/(site)/[...path]). Requests that need per-request rendering go to
  // the dynamic renderer app/(site)/dyn-render: a meaningful query string, or the cart / checkout / my-account pages.
  if (needsDynamic(pathname, searchParams)) {
    const u = req.nextUrl.clone();
    u.pathname = "/dyn-render" + (pathname === "/" ? "/" : pathname);
    return NextResponse.rewrite(u);
  }
  return NextResponse.next();
}

/** Query parameters that don't change the page (tracking, Next.js RSC cache-busting) — those requests stay static. */
const STATIC_PARAMS = /^(utm_\w+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|yclid|twclid|ttclid|li_fat_id|mc_cid|mc_eid|_ga|_gl|_rsc|srsltid)$/;

/** Cart (6, 1036), checkout (7, 1037) and my-account (8, 10) pages — see CART_PAGES etc. in lib/resolve.ts. */
const DYN_PAGE_IDS = "6,7,8,10,1036,1037";
let dynSlugs = new Set(["cart", "cart-2", "checkout", "checkout-2", "my-account", "my-account-2"]);
let dynCheckedAt = 0;
function refreshDynSlugs() {
  if (Date.now() - dynCheckedAt < 300_000) return;
  dynCheckedAt = Date.now();
  rest(`posts?select=slug,path&status=eq.publish&id=in.(${DYN_PAGE_IDS})`)
    .then((rows) => {
      const s = rows.map((r) => String(r.path || `/${r.slug}/`).split("/").filter(Boolean)[0]).filter(Boolean);
      if (s.length) dynSlugs = new Set(s.map((x) => { try { return decodeURIComponent(x); } catch { return x; } }));
    })
    .catch(() => {});
}

function needsDynamic(pathname: string, sp: URLSearchParams) {
  for (const k of sp.keys()) if (!STATIC_PARAMS.test(k)) return true;
  refreshDynSlugs();
  let first = pathname.split("/").filter(Boolean)[0] || "";
  try { first = decodeURIComponent(first); } catch { /* raw */ }
  return dynSlugs.has(first);
}

export const config = {
  matcher: ["/((?!_next/|api/|wp/|favicon.ico).*)"],
};
