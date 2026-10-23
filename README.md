# palacetw — 台灣宮廷酒廠（palacetwshop.com）Next.js 重建

Next.js 16 App Router + Supabase（schema `site_palacetw`）。前台以舊站 OceanWP / Elementor / WooCommerce 的 HTML 結構與原始樣式重建。

## 結構
- `app/[...path]/page.tsx`：所有舊站網址（頁面、文章、商品、分類／標籤彙整、分頁、日期與作者彙整、購物車、結帳、我的帳號）由 `lib/resolve.ts` 解析。
- `app/page.tsx`：首頁與搜尋（`?s=`）。
- `proxy.ts`：舊附件頁 `?attachment_id=` 與 `/wp-content/uploads/...` 301 到 Supabase Storage；`?p=` / `?page_id=` 短網址 301。
- `public/wp/theme.css`：由 `scripts/build-theme.mjs` 從抽取的原站樣式產生（`body.xxx` 選擇器改寫為 `.wpb.xxx`，字型改本地、圖片改新網址）。
- 購物車／結帳：`/api/cart`、`/api/checkout`，只建立「待付款」訂單，不串任何金流。
- 表單：留言表單 → `site_palacetw.form_submissions`（並以 hold 狀態寫入 comments）。
- 會員：Supabase Auth（登入／註冊 `?action=register`／忘記密碼／訂單紀錄）。
- SEO：Rank Math 的 title / description / robots / canonical / OG / JSON-LD 來自 `posts.seo`；`/sitemap_index.xml`、`/{post,page,product,product_cat,category}-sitemap.xml`、`/sitemap.xml`、`/robots.txt`、`/feed/`；Facebook Pixel 與網域驗證。

## 環境變數
`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`（僅伺服器端）、`NEXT_PUBLIC_SITE_URL`。

## 驗證腳本（需要不在 repo 內的 export 目錄）
- `EXPORT_DIR=../export BASE=http://localhost:3100 node scripts/check-urls.mjs`：urls.json 全部 200、附件頁 301。
- `EXPORT_DIR=../export OUT=/tmp/shots node scripts/visual-diff.mjs`：與舊站截圖做像素差異比對。
- `PRODUCT_PATH=/product/... node scripts/e2e.mjs`：購物車→結帳→待付款訂單、留言表單、Quick View、手機選單等（需要一個有價格的商品）。

## 後台 /admin
- 登入：Supabase Auth；只有 `site_palacetw.admins` 內的使用者可進（`proxy.ts` 對所有 /admin 請求檢查，Server Actions 與匯出路由再檢查一次）。種子管理員由 `scripts/seed-admin.mjs` 建立（密碼只寫入本機 env 檔）。
- 功能：控制台、文章／頁面／彈出視窗（所見即所得編輯器＋HTML 原始碼、草稿、儲存並預覽、發布、排程、私密、回收桶）、分類／標籤、媒體庫（上傳自動轉 WebP，最長邊 2000、品質 80）、留言審核、商品（價格、特價期間、庫存、商品圖庫、屬性與變體、列表快速編輯）、訂單（列表、篩選、明細、狀態更新含庫存扣回、備註、地址、CSV 匯出）、顧客、優惠券、數量折扣規則、選單編輯、表單提交（標記、CSV 匯出）、網站設定（名稱、logo、favicon、聯絡資訊、追蹤碼、所有設定 JSON）、轉址管理（改代稱自動建立轉址）、稽核紀錄。
- 寫入一律經 `lib/admin/*`（service role）並寫入 `site_palacetw.audit_log`；後台與 MCP 共用同一套服務層。
- 排程：`status=future` 到時間由 `site_palacetw.publish_due()` 轉為發布（前台資料快取重建、後台、MCP 請求與每日 Vercel Cron `/api/cron/publish` 都會觸發）。

## MCP /api/mcp
- Streamable HTTP（無狀態、JSON 回應），`Authorization: Bearer $MCP_TOKEN`。46 個工具：文章／頁面／商品 CRUD（刪除預設進回收桶）、價格庫存、變體、分類、媒體上傳、訂單查詢與狀態、顧客、優惠券、數量折扣、表單提交、選單、轉址、網站設定、稽核紀錄。
- 驗證：`MCP_URL=http://localhost:3000/api/mcp MCP_TOKEN=... node scripts/mcp-smoke.mjs`（tools/list → 讀文章 → 新增草稿 → 修改 → 刪除）。

## 環境變數（另需）
`MCP_TOKEN`（MCP 驗證）、`CRON_SECRET`（選填，保護 /api/cron/publish）。
