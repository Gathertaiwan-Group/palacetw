-- RLS for site_palacetw: every table has RLS on.
-- anon/authenticated may read published public content only; private commerce/user data is readable
-- only by site admins (site_palacetw.admins). All writes go through the server with the service role.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'site_palacetw' loop
    execute format('alter table site_palacetw.%I enable row level security', t);
    execute format('grant all on site_palacetw.%I to service_role', t);
    execute format('revoke insert, update, delete, truncate on site_palacetw.%I from anon, authenticated', t);
    execute format('grant select on site_palacetw.%I to anon, authenticated', t);
    -- admin read policy on every table
    execute format('drop policy if exists admin_read on site_palacetw.%I', t);
    execute format('create policy admin_read on site_palacetw.%I for select to authenticated using ((select site_palacetw.is_admin()))', t);
  end loop;
end $$;
grant usage, select on all sequences in schema site_palacetw to service_role;
grant execute on function site_palacetw.is_admin() to anon, authenticated, service_role;

-- public read policies
drop policy if exists public_read on site_palacetw.settings;
create policy public_read on site_palacetw.settings for select to anon, authenticated using (is_public);

drop policy if exists public_read on site_palacetw.authors;
create policy public_read on site_palacetw.authors for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.terms;
create policy public_read on site_palacetw.terms for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.posts;
create policy public_read on site_palacetw.posts for select to anon, authenticated
  using (status = 'publish' and post_type <> 'shop_coupon');

drop policy if exists public_read on site_palacetw.term_relationships;
create policy public_read on site_palacetw.term_relationships for select to anon, authenticated
  using (exists (select 1 from site_palacetw.posts p where p.id = object_id and p.status = 'publish'));

drop policy if exists public_read on site_palacetw.media;
create policy public_read on site_palacetw.media for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.media_url_map;
create policy public_read on site_palacetw.media_url_map for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.comments;
create policy public_read on site_palacetw.comments for select to anon, authenticated using (status = 'approved');

drop policy if exists public_read on site_palacetw.menus;
create policy public_read on site_palacetw.menus for select to anon, authenticated using (true);
drop policy if exists public_read on site_palacetw.menu_items;
create policy public_read on site_palacetw.menu_items for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.product_attributes;
create policy public_read on site_palacetw.product_attributes for select to anon, authenticated using (true);

drop policy if exists public_read on site_palacetw.products;
create policy public_read on site_palacetw.products for select to anon, authenticated
  using (exists (select 1 from site_palacetw.posts p where p.id = post_id and p.status = 'publish'));

drop policy if exists public_read on site_palacetw.product_attribute_values;
create policy public_read on site_palacetw.product_attribute_values for select to anon, authenticated
  using (visible and exists (select 1 from site_palacetw.posts p where p.id = product_id and p.status = 'publish'));

drop policy if exists public_read on site_palacetw.product_variations;
create policy public_read on site_palacetw.product_variations for select to anon, authenticated
  using (status = 'publish' and exists (select 1 from site_palacetw.posts p where p.id = product_id and p.status = 'publish'));

drop policy if exists public_read on site_palacetw.quantity_discount_rules;
create policy public_read on site_palacetw.quantity_discount_rules for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));

drop policy if exists public_read on site_palacetw.forms;
create policy public_read on site_palacetw.forms for select to anon, authenticated using (status = 'publish');

drop policy if exists public_read on site_palacetw.redirects;
create policy public_read on site_palacetw.redirects for select to anon, authenticated using (true);

-- private tables (admins, audit_log, customers, carts, cart_items, coupons, orders, order_items,
-- order_notes, form_submissions) intentionally have no anon policy.

-- column-level protection for sensitive columns on publicly readable tables
revoke select on site_palacetw.posts from anon, authenticated;
grant select (id, post_type, status, slug, path, title, content, excerpt, author_id, parent_id, menu_order,
  template, format, sticky, comment_status, ping_status, featured_media_id, published_at, date_local,
  modified_at, seo, meta, old_url, created_at, updated_at) on site_palacetw.posts to anon, authenticated;
revoke select on site_palacetw.comments from anon, authenticated;
grant select (id, post_id, parent_id, author_id, author_name, author_url, content, status, type, rating,
  created_at, meta) on site_palacetw.comments to anon, authenticated;
revoke select on site_palacetw.authors from anon, authenticated;
grant select (id, slug, display_name, description, avatar_url, meta, created_at) on site_palacetw.authors to anon, authenticated;
