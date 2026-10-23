-- Frontend (stage 2): register the old site's front-end forms so submissions can be attributed.
-- The only content form on palacetwshop.com is the WordPress comment form (wp-comments-post.php);
-- search / ordering are GET forms, login & checkout write to Supabase Auth / site_palacetw.orders.
insert into site_palacetw.forms (title, slug, source, fields, settings, status)
values (
  '文章留言（WordPress 留言表單）', 'comment-form', 'wordpress-comments',
  '[{"name":"comment","type":"textarea","label":"留言","required":true},
    {"name":"author","type":"text","label":"顯示名稱","required":true},
    {"name":"email","type":"email","label":"電子郵件","required":true},
    {"name":"url","type":"url","label":"個人網站","required":false},
    {"name":"wp-comment-cookies-consent","type":"checkbox","label":"在瀏覽器中儲存顯示名稱、電子郵件地址及個人網站網址","required":false}]'::jsonb,
  '{"store_as_comment":true,"comment_status":"hold","old_action":"/wp-comments-post.php"}'::jsonb,
  'publish'
)
on conflict (slug) do nothing;
