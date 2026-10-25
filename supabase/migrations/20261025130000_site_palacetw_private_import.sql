-- Stage 3: private WordPress data import (orders, customers, notes, comments, menus, settings).
-- Customers / orders and other private commerce + submission tables are readable by NOBODY except
-- the service role (admin panel and MCP run server-side with it). anon and authenticated get no grant
-- and no policy at all, so even a signed-in Supabase user (incl. an admin JWT) cannot read them via PostgREST.

-- private attachments (WordPress attachments with post_status = 'private'): metadata only, never public
create table if not exists site_palacetw.private_attachments (
  id          bigint primary key,            -- wp attachment ID
  title       text not null default '',
  mime_type   text,
  file_path   text,                          -- _wp_attached_file (relative to uploads/)
  parent_id   bigint,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array[
    'customers','orders','order_items','order_notes','order_refunds','carts','cart_items','coupons',
    'form_submissions','comment_private','post_secrets','private_attachments','plugin_options'
  ] loop
    execute format('alter table site_palacetw.%I enable row level security', t);
    execute format('grant all on site_palacetw.%I to service_role', t);
    execute format('revoke all on site_palacetw.%I from anon, authenticated', t);
    execute format('drop policy if exists admin_read on site_palacetw.%I', t);
    execute format('drop policy if exists public_read on site_palacetw.%I', t);
  end loop;
end $$;

-- lookups used by the importer / admin search
create index if not exists orders_date_idx on site_palacetw.orders(date_created desc);
create index if not exists customers_wp_lookup_idx on site_palacetw.customers using gin ((meta -> 'wc_customer_lookup_ids'));
