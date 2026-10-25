-- Responsive WebP variants (480 / 960 / 1440 wide, never upscaled) stored in bucket site-palacetw under v/<w>/<path>.webp.
-- Each entry: {"w": 480, "h": 600, "path": "v/480/uploads/2021/04/x.webp", "url": "https://…/v/480/…", "bytes": 12345}
alter table site_palacetw.media add column if not exists variants jsonb not null default '[]'::jsonb;
