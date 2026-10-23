-- Replace column-level grants with private side tables so PostgREST `select=*` works for anon on public tables.
create table if not exists site_palacetw.post_secrets (
  post_id   bigint primary key references site_palacetw.posts(id) on delete cascade,
  password  text not null
);
create table if not exists site_palacetw.comment_private (
  comment_id    bigint primary key references site_palacetw.comments(id) on delete cascade,
  author_email  text,
  author_ip     inet,
  user_agent    text
);
alter table site_palacetw.posts drop column if exists password;
alter table site_palacetw.comments drop column if exists author_email, drop column if exists author_ip, drop column if exists user_agent;
alter table site_palacetw.authors drop column if exists auth_user_id;
alter table site_palacetw.admins add column if not exists author_id bigint references site_palacetw.authors(id) on delete set null;
create index if not exists admins_author_idx on site_palacetw.admins(author_id);

do $$
declare t text;
begin
  foreach t in array array['post_secrets','comment_private'] loop
    execute format('alter table site_palacetw.%I enable row level security', t);
    execute format('grant all on site_palacetw.%I to service_role', t);
    execute format('revoke all on site_palacetw.%I from anon, authenticated', t);
    execute format('grant select on site_palacetw.%I to authenticated', t);
    execute format('drop policy if exists admin_read on site_palacetw.%I', t);
    execute format('create policy admin_read on site_palacetw.%I for select to authenticated using ((select site_palacetw.is_admin()))', t);
  end loop;
  foreach t in array array['posts','comments','authors'] loop
    execute format('revoke select on site_palacetw.%I from anon, authenticated', t);
    execute format('grant select on site_palacetw.%I to anon, authenticated', t);
  end loop;
end $$;
