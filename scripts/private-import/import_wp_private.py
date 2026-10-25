"""Import private WordPress data for palacetw into site_palacetw. Prints counts only (no PII)."""
import json, os, re, sys, subprocess, ipaddress, collections, datetime, secrets

SRC = os.path.expanduser("~/gather-migrate/_db/palacetw/tables")
Q = os.path.join(os.path.dirname(os.path.abspath(__file__)), "q.sh")
S = "site_palacetw"
DRY = "--dry" in sys.argv


def rows(t):
    if not os.path.exists(os.path.join(SRC, t + ".jsonl")):
        return
    with open(os.path.join(SRC, t + ".jsonl")) as f:
        for l in f:
            if l.strip():
                yield json.loads(l)


def sql(q):
    if DRY:
        return []
    r = subprocess.run([Q, "-"], input=q, capture_output=True, text=True)
    out = r.stdout.strip()
    try:
        d = json.loads(out) if out else []
    except Exception:
        d = None
    if r.returncode != 0 or d is None or (isinstance(d, dict) and d.get("message")):
        msg = d.get("message") if isinstance(d, dict) else out[:300]
        # never echo the payload; message from Postgres may include a row value, so truncate hard
        raise SystemExit("SQL error: " + str(msg)[:200])
    return d


def lit(obj):
    tag = "j" + secrets.token_hex(6)
    s = json.dumps(obj, ensure_ascii=False)
    assert f"${tag}$" not in s
    return f"${tag}${s}${tag}$::jsonb"


def upsert(table, recs, conflict="id", batch=80):
    if not recs:
        return
    cols = list(recs[0].keys())
    sets = ", ".join(f"{c} = excluded.{c}" for c in cols if c != conflict)
    for i in range(0, len(recs), batch):
        chunk = recs[i:i + batch]
        q = (f"insert into {S}.{table} ({', '.join(cols)}) "
             f"select {', '.join(cols)} from jsonb_populate_recordset(null::{S}.{table}, {lit(chunk)}) "
             f"on conflict ({conflict}) do update set {sets};")
        sql(q)


def ts_gmt(s):
    if not s or s.startswith("0000"):
        return None
    return s.replace(" ", "T") + "+00:00"


def ts_unix(v):
    try:
        v = int(v)
        return datetime.datetime.fromtimestamp(v, datetime.timezone.utc).isoformat() if v > 0 else None
    except Exception:
        return None


def num(v):
    try:
        return round(float(v), 2)
    except Exception:
        return 0.0


def ip(v):
    try:
        return str(ipaddress.ip_address((v or "").strip()))
    except Exception:
        return None


def php_strings(v):
    return re.findall(r's:\d+:"(.*?)";', v or "")


# ------------------------------------------------------------------ load
posts = {p["ID"]: p for p in rows("wp_posts")}
meta = collections.defaultdict(dict)
for m in rows("wp_postmeta"):
    meta[m["post_id"]][m["meta_key"]] = m["meta_value"]
stats = {r["order_id"]: r for r in rows("wp_wc_order_stats")}
lookup = list(rows("wp_wc_customer_lookup"))
comments = list(rows("wp_comments"))
orders_src = [p for p in posts.values() if p["post_type"] == "shop_order"]
existing_posts = {r["id"]: r for r in sql(f"select id, path, title from {S}.posts")} if not DRY else {}

report = collections.OrderedDict()

# ------------------------------------------------------------------ customers (wc_customer_lookup, dedup by email)
groups = collections.OrderedDict()
for c in sorted(lookup, key=lambda r: r["customer_id"]):
    groups.setdefault((c["email"] or "").strip().lower(), []).append(c)
lookup_to_cust = {}
for em, g in groups.items():
    for c in g:
        lookup_to_cust[c["customer_id"]] = g[0]["customer_id"]

ADDR = ["first_name", "last_name", "company", "address_1", "address_2", "city", "state", "postcode", "country", "email", "phone"]


def addr(m, kind):
    keys = ADDR if kind == "billing" else [k for k in ADDR if k not in ("email",)]
    return {k: m.get(f"_{kind}_{k}", "") or "" for k in keys}


orders_by_cust = collections.defaultdict(list)
for p in orders_src:
    st = stats.get(p["ID"])
    if st and st["customer_id"] in lookup_to_cust:
        orders_by_cust[lookup_to_cust[st["customer_id"]]].append(p)

cust_recs = []
for em, g in groups.items():
    first = g[0]
    latest = max(g, key=lambda r: r["date_last_active"] or "")
    cid = first["customer_id"]
    ords = sorted(orders_by_cust.get(cid, []), key=lambda p: p["post_date_gmt"])
    billing = addr(meta[ords[-1]["ID"]], "billing") if ords else {}
    shipping = addr(meta[ords[-1]["ID"]], "shipping") if ords else {}
    if not billing:
        billing = {"first_name": first["first_name"] or "", "last_name": first["last_name"] or "", "email": first["email"],
                   "country": first["country"] or "", "postcode": first["postcode"] or "", "city": first["city"] or "", "state": first["state"] or ""}
    fn, ln = latest["first_name"] or "", latest["last_name"] or ""
    cust_recs.append({
        "id": cid,
        "email": (latest["email"] or "").strip(),
        "username": latest["username"] or None,
        "first_name": fn, "last_name": ln,
        "display_name": (f"{fn} {ln}").strip() or None,
        "role": "customer",
        "billing": billing, "shipping": shipping,
        "is_paying_customer": any(meta[o["ID"]].get("_date_paid") for o in ords),
        "date_registered": ts_gmt(min((r["date_registered"] or "9999") for r in g)) if any(r["date_registered"] for r in g) else None,
        "last_active": ts_gmt(latest["date_last_active"]),
        "meta": {"source": "wp", "wc_customer_lookup_ids": [r["customer_id"] for r in g],
                 "wp_user_ids": sorted({r["user_id"] for r in g if r["user_id"]})},
    })
report["customers_src_lookup_rows"] = len(lookup)
report["customers_src_unique_email"] = len(groups)

# ------------------------------------------------------------------ orders
STATUS_OK = {"pending", "processing", "on-hold", "completed", "cancelled", "refunded", "failed", "checkout-draft", "trash"}
order_recs = []
for p in sorted(orders_src, key=lambda p: p["ID"]):
    m = meta[p["ID"]]
    st = stats.get(p["ID"], {})
    status = p["post_status"][3:] if p["post_status"].startswith("wc-") else p["post_status"]
    assert status in STATUS_OK, status
    ship_method = m.get("_shipping_method")
    order_recs.append({
        "id": p["ID"],
        "order_number": str(p["ID"]),
        "order_key": m.get("_order_key") or None,
        "status": status,
        "currency": m.get("_order_currency") or "TWD",
        "prices_include_tax": m.get("_prices_include_tax") == "yes",
        "customer_id": lookup_to_cust.get(st.get("customer_id")),
        "billing": addr(m, "billing"),
        "shipping": addr(m, "shipping"),
        "payment_method": m.get("_payment_method") or None,
        "payment_method_title": m.get("_payment_method_title") or None,
        "transaction_id": m.get("_transaction_id") or None,
        "customer_ip": ip(m.get("_customer_ip_address")),
        "customer_user_agent": m.get("_customer_user_agent") or None,
        "customer_note": p["post_excerpt"] or "",
        "created_via": m.get("_created_via") or "checkout",
        "discount_total": num(m.get("_cart_discount")),
        "discount_tax": num(m.get("_cart_discount_tax")),
        "shipping_total": num(m.get("_order_shipping")),
        "shipping_tax": num(m.get("_order_shipping_tax")),
        "cart_tax": num(m.get("_order_tax")),
        "total_tax": round(num(m.get("_order_tax")) + num(m.get("_order_shipping_tax")), 2),
        "total": num(m.get("_order_total")),
        "coupon_codes": [],
        "date_created": ts_gmt(p["post_date_gmt"]),
        "date_modified": ts_gmt(p["post_modified_gmt"]) or ts_gmt(p["post_date_gmt"]),
        "date_paid": ts_unix(m.get("_date_paid")) or ts_unix(m.get("_paid_date")) if m.get("_date_paid") else None,
        "date_completed": ts_unix(m.get("_date_completed")) if m.get("_date_completed") else None,
        "meta": {k: v for k, v in {
            "source": "wp", "_order_key": m.get("_order_key") or None, "wp_customer_user": int(m.get("_customer_user") or 0),
            "order_version": m.get("_order_version"), "shipping_method": php_strings(ship_method) if ship_method else None,
            "order_stock_reduced": m.get("_order_stock_reduced"), "recorded_sales": m.get("_recorded_sales"),
            "is_vat_exempt": m.get("is_vat_exempt"),
            "wc_order_stats": {k: st.get(k) for k in ("num_items_sold", "total_sales", "tax_total", "shipping_total", "net_total", "returning_customer")} if st else None,
        }.items() if v not in (None, "")},
    })
seen_keys = set()
dup_keys = 0
for r in order_recs:
    k = r["order_key"]
    if k and k in seen_keys:
        r["meta"]["wp_order_key_duplicate"] = k
        r["order_key"] = f"{k}-{r['id']}"
        dup_keys += 1
    seen_keys.add(k)
report["orders_duplicate_order_key_renamed"] = dup_keys
report["orders_src"] = len(orders_src)
report["orders_src_total_postmeta"] = round(sum(num(meta[p["ID"]].get("_order_total")) for p in orders_src), 2)
report["orders_src_total_order_stats"] = round(sum(s["total_sales"] for s in stats.values()), 2)
report["orders_src_by_status"] = dict(collections.Counter(r["status"] for r in order_recs))
report["order_items_src"] = sum(1 for _ in rows("wp_woocommerce_order_items"))

# ------------------------------------------------------------------ order notes + post comments
note_recs, com_recs, com_priv, com_skipped = [], [], [], 0
STAT = {"1": "approved", "0": "hold", "spam": "spam", "trash": "trash", "post-trashed": "trash"}
order_ids = {p["ID"] for p in orders_src}
for c in comments:
    if c["comment_type"] == "order_note":
        if c["comment_post_ID"] in order_ids:
            note_recs.append({"id": c["comment_ID"], "order_id": c["comment_post_ID"], "content": c["comment_content"],
                              "is_customer_note": False, "added_by": c["comment_author"] or None,
                              "created_at": ts_gmt(c["comment_date_gmt"])})
        continue
    if not DRY and c["comment_post_ID"] not in existing_posts:
        com_skipped += 1
        continue
    com_recs.append({"id": c["comment_ID"], "post_id": c["comment_post_ID"], "parent_id": c["comment_parent"] or None,
                     "author_id": None, "author_name": c["comment_author"] or "", "author_url": c["comment_author_url"] or None,
                     "content": c["comment_content"], "status": STAT.get(str(c["comment_approved"]), "hold"),
                     "type": c["comment_type"] or "comment", "rating": None, "created_at": ts_gmt(c["comment_date_gmt"]),
                     "meta": {"source": "wp", "karma": c["comment_karma"]}})
    com_priv.append({"comment_id": c["comment_ID"], "author_email": c["comment_author_email"] or None,
                     "author_ip": ip(c["comment_author_IP"]), "user_agent": c["comment_agent"] or None})
report["order_notes_src"] = sum(1 for c in comments if c["comment_type"] == "order_note")
report["comments_src"] = sum(1 for c in comments if c["comment_type"] != "order_note")
report["comments_skipped_missing_post"] = com_skipped
# parents must exist among imported
ids = {r["id"] for r in com_recs}
for r in com_recs:
    if r["parent_id"] and r["parent_id"] not in ids:
        r["parent_id"] = None

# ------------------------------------------------------------------ menus
terms = {t["term_id"]: t for t in rows("wp_terms")}
tt = {t["term_taxonomy_id"]: t for t in rows("wp_term_taxonomy") if t["taxonomy"] == "nav_menu"}
item_menu = {}
for r in rows("wp_term_relationships"):
    if r["term_taxonomy_id"] in tt:
        item_menu[r["object_id"]] = tt[r["term_taxonomy_id"]]["term_id"]
LOC = {}
for o in rows("wp_options"):
    if o["option_name"] == "theme_mods_oceanwp":
        mm = re.search(r'nav_menu_locations";a:\d+:\{(.*?)\}', o["option_value"])
        for k, v in re.findall(r's:\d+:"([a-z_]+)";i:(\d+);', mm.group(1)):
            LOC[k] = int(v)
menu_recs = []
for t in tt.values():
    tid = t["term_id"]
    menu_recs.append({"id": tid, "name": terms[tid]["name"], "slug": terms[tid]["slug"],
                      "locations": sorted(k for k, v in LOC.items() if v == tid), "source": "wp"})
items = [p for p in posts.values() if p["post_type"] == "nav_menu_item"]
item_ids = {p["ID"] for p in items}
OLD = re.compile(r"^https?://(www\.)?palacetwshop\.com", re.I)
mi_recs = []
for p in sorted(items, key=lambda p: (item_menu.get(p["ID"], 0), p["menu_order"])):
    m = meta[p["ID"]]
    typ, obj, oid = m.get("_menu_item_type"), m.get("_menu_item_object"), int(m.get("_menu_item_object_id") or 0)
    par = int(m.get("_menu_item_menu_item_parent") or 0)
    title, url = p["post_title"], m.get("_menu_item_url") or None
    extra = {"source": "wp", "wp_type": typ}
    if typ == "post_type":
        tgt = existing_posts.get(oid)
        url = tgt["path"] if tgt else None
        if not title:
            title = tgt["title"] if tgt else (posts.get(oid, {}).get("post_title") or "")
        if not tgt:
            extra["missing_object"] = True
    elif url:
        url = OLD.sub("", url) or "/"
        if url.startswith("#") is False and url.startswith("/") is False and url.startswith("http") is False:
            pass
    if par and par not in item_ids:
        extra["orphan_parent"] = par
        par = 0
    mi_recs.append({"id": p["ID"], "menu_id": item_menu[p["ID"]], "parent_id": par or None, "position": p["menu_order"],
                    "title": title or "", "url": url, "object_type": obj if typ != "custom" else "custom",
                    "object_id": oid if typ != "custom" else None, "target": m.get("_menu_item_target") or None,
                    "classes": [c for c in php_strings(m.get("_menu_item_classes")) if c],
                    "attr_title": m.get("_menu_item_attr_title") or p["post_excerpt"] or None, "meta": extra})
# parents before children
order_ix = {r["id"]: i for i, r in enumerate(mi_recs)}
BYID = {x["id"]: x for x in mi_recs}
def depth(r):
    d, cur = 0, r
    while cur["parent_id"]:
        d += 1; cur = BYID[cur["parent_id"]]
    return d
mi_recs.sort(key=lambda r: (depth(r), order_ix[r["id"]]))
report["menus_src"] = len(menu_recs)
report["menu_items_src"] = len(items)

# ------------------------------------------------------------------ private attachments
pa = []
for p in posts.values():
    if p["post_type"] == "attachment" and p["post_status"] == "private":
        pa.append({"id": p["ID"], "title": p["post_title"], "mime_type": p["post_mime_type"],
                   "file_path": meta[p["ID"]].get("_wp_attached_file"), "parent_id": p["post_parent"] or None,
                   "meta": {"source": "wp"}, "created_at": ts_gmt(p["post_date_gmt"])})
report["private_attachments_src"] = len(pa)

# ------------------------------------------------------------------ settings (WooCommerce front-end related)
opts = {o["option_name"]: o["option_value"] for o in rows("wp_options")}
wc = {
    "default_country": opts.get("woocommerce_default_country"),
    "currency_pos": opts.get("woocommerce_currency_pos"),
    "price_thousand_sep": opts.get("woocommerce_price_thousand_sep"),
    "price_decimal_sep": opts.get("woocommerce_price_decimal_sep"),
    "price_num_decimals": int(opts.get("woocommerce_price_num_decimals") or 0),
    "calc_taxes": opts.get("woocommerce_calc_taxes") == "yes",
    "prices_include_tax": opts.get("woocommerce_prices_include_tax") == "yes",
    "tax_display_shop": opts.get("woocommerce_tax_display_shop"),
    "tax_display_cart": opts.get("woocommerce_tax_display_cart"),
    "enable_guest_checkout": opts.get("woocommerce_enable_guest_checkout") == "yes",
    "enable_myaccount_registration": opts.get("woocommerce_enable_myaccount_registration") == "yes",
    "enable_shipping_calc": opts.get("woocommerce_enable_shipping_calc") == "yes",
    "ship_to_destination": opts.get("woocommerce_ship_to_destination"),
    "ship_to_countries": opts.get("woocommerce_ship_to_countries") or "",
    "checkout_privacy_policy_text": opts.get("woocommerce_checkout_privacy_policy_text"),
    "registration_privacy_policy_text": opts.get("woocommerce_registration_privacy_policy_text"),
    "shipping_zones": 0, "tax_rates": 0,
}
wc = {k: v for k, v in wc.items() if v is not None}

# ------------------------------------------------------------------ SEO extras (Rank Math focus keyword / primary term)
seo_extra = {}
for pid, m in meta.items():
    e = {}
    if m.get("rank_math_focus_keyword"): e["focus_keyword"] = m["rank_math_focus_keyword"]
    if m.get("rank_math_primary_product_cat"): e["primary_term_id"] = int(m["rank_math_primary_product_cat"] or 0) or None
    e = {k: v for k, v in e.items() if v}
    if e and posts.get(pid, {}).get("post_type") in ("post", "page", "product"):
        seo_extra[pid] = e

if "--counts" in sys.argv or DRY:
    print(json.dumps(report, ensure_ascii=False, indent=1))
    sys.exit(0)

# ------------------------------------------------------------------ write
# customers: make sure no imported email collides with a pre-existing non-wp customer row
pre = sql(f"select id, lower(email) e from {S}.customers where coalesce(meta->>'source','') <> 'wp'")
pre_e = {r["e"]: r["id"] for r in pre}
coll = [r for r in cust_recs if r["email"].lower() in pre_e]
if coll:
    raise SystemExit(f"email collision with {len(coll)} pre-existing customer rows; aborting")
upsert("customers", cust_recs)
upsert("orders", order_recs)
upsert("order_notes", note_recs)
upsert("comments", [r for r in com_recs if not r["parent_id"]])
upsert("comments", [r for r in com_recs if r["parent_id"]])
upsert("comment_private", com_priv, conflict="comment_id")
# menus: replace the HTML-reconstructed menu with the real WordPress menus
sql(f"delete from {S}.menus where source = 'html';")
upsert("menus", menu_recs)
sql(f"delete from {S}.menu_items where menu_id in ({','.join(str(m['id']) for m in menu_recs)}) "
    f"and id not in ({','.join(str(r['id']) for r in mi_recs)});")
upsert("menu_items", mi_recs, batch=200)
main = LOC.get("main_menu")
sql(f"""insert into {S}.settings (key, value, is_public, updated_at) values
 ('primary_menu', {lit({"slug": terms[main]["slug"], "menu_id": main, "location": "main_menu"})}, true, now()),
 ('menu_locations', {lit({k: (v or None) for k, v in LOC.items()})}, true, now())
 on conflict (key) do update set value = excluded.value, updated_at = now();""")
sql(f"update {S}.settings set value = {lit(wc)} || value, updated_at = now() where key = 'woocommerce';")
upsert("private_attachments", pa)
for pid, e in seo_extra.items():
    sql(f"update {S}.posts set seo = {lit(e)} || seo where id = {int(pid)};")
print(json.dumps(report, ensure_ascii=False, indent=1))
print("written: customers", len(cust_recs), "orders", len(order_recs), "notes", len(note_recs), "comments", len(com_recs),
      "menus", len(menu_recs), "menu_items", len(mi_recs), "private_attachments", len(pa), "seo_extra", len(seo_extra))
