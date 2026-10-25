-- Rank Math sitemap scope as on the old site: post/page/product sitemaps only, /x/ (post 2347) excluded.
update site_palacetw.settings
   set value = value || '{"sitemap_types": ["post", "page", "product"], "sitemap_exclude_ids": [2347]}'::jsonb, updated_at = now()
 where key = 'seo';
-- Author archive: the old WordPress author slug (an e-mail address) is not exposed; 301 to the renamed author.
insert into site_palacetw.redirects (source_path, target, status_code, kind)
select '/author/armand7951gmail-com/', '/author/admin/', 301, 'author'
 where not exists (select 1 from site_palacetw.redirects where source_path = '/author/armand7951gmail-com/');
