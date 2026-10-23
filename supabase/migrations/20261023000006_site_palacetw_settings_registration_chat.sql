-- 1:1 with the old site: WooCommerce "allow registration on My account" was off, and the discontinued
-- FB Customer Chat no longer rendered, so the Messenger bubble is off by default (toggle in /admin/settings JSON).
update site_palacetw.settings
   set value = coalesce(value, '{}'::jsonb) || jsonb_build_object('enable_myaccount_registration', false)
 where key = 'woocommerce' and not (value ? 'enable_myaccount_registration');
update site_palacetw.settings
   set value = coalesce(value, '{}'::jsonb) || jsonb_build_object('enabled', false)
 where key = 'chat_widget' and not (value ? 'enabled');
