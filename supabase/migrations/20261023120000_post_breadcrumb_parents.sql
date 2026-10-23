-- Post 2347 ("x"): the old Rank Math breadcrumb showed a post_parent ancestor "c" (首頁 » c » x).
update site_palacetw.posts
set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('breadcrumb_parents', jsonb_build_array(jsonb_build_object('label', 'c', 'href', '/f9dcfa81-33f3-40e8-aa91-a59821ad6ecf/')))
where id = 2347;
