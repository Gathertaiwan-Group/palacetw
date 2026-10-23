#!/usr/bin/env node
// Front-end smoke test: cart → checkout (pending order), comment form, quick view, mobile menu, search, sticky header.
// Requires one purchasable product id in PRODUCT (e.g. a temporary price set by the tester).
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(path.join(process.env.TOOLS || path.join(process.env.HOME, "gather-migrate/_tools"), "package.json"));
const { chromium } = require("playwright");
const BASE = (process.env.BASE || "http://localhost:3100").replace(/\/$/, "");
const PRODUCT_PATH = process.env.PRODUCT_PATH;
const SHOT = process.env.SHOT || "/tmp";
const log = (...a) => console.log(...a);
const b = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const out = {};

// product page: price, qty discount table, add to cart with qty 2
await p.goto(BASE + PRODUCT_PATH, { waitUntil: "networkidle" });
out.price = (await p.textContent(".summary .price"))?.trim();
out.qtyTable = (await p.locator(".qty-discount-table").count()) > 0;
await p.fill("input.qty", "2");
await p.click("button.single_add_to_cart_button");
await p.waitForSelector(".summary .woocommerce-message", { timeout: 15000 });
out.addMsg = (await p.textContent(".summary .woocommerce-message"))?.trim();
await p.waitForTimeout(500);
out.headerCount = (await p.textContent("#site-navigation .wcmenucart-details.count"))?.trim();
// gallery lightbox
await p.click(".woocommerce-product-gallery__trigger");
out.lightbox = await p.locator(".pt-lightbox").isVisible();
await p.keyboard.press("Escape");

// cart
await p.goto(BASE + "/cart-2/", { waitUntil: "networkidle" });
out.cartRows = await p.locator("tr.cart_item").count();
out.cartTotal = (await p.textContent(".order-total td"))?.trim();
await p.screenshot({ path: path.join(SHOT, "e2e_cart.png") });

// checkout
await p.goto(BASE + "/checkout-2/", { waitUntil: "networkidle" });
await p.fill("#billing_first_name", "測試");
await p.fill("#billing_last_name", "前台");
await p.fill("#billing_address_1", "測試路1號");
await p.fill("#billing_city", "桃園市");
await p.fill("#billing_postcode", "330");
await p.fill("#billing_phone", "0900000000");
await p.fill("#billing_email", "frontend-test@example.com");
await p.fill("#order_comments", "E2E TEST ORDER - safe to delete");
await p.screenshot({ path: path.join(SHOT, "e2e_checkout.png"), fullPage: true });
await p.click("#place_order");
await p.waitForURL(/order-received/, { timeout: 20000 });
out.orderUrl = p.url().replace(BASE, "");
out.thankyou = (await p.textContent(".woocommerce-thankyou-order-received"))?.trim();
out.orderStatus = (await p.textContent(".woocommerce-order-overview__status strong"))?.trim();
await p.screenshot({ path: path.join(SHOT, "e2e_order_received.png"), fullPage: true });

// comment form
await p.goto(BASE + "/litora-torqent-per-conubia/", { waitUntil: "networkidle" });
await p.fill("#comment", "E2E TEST COMMENT - safe to delete");
await p.fill("#author", "E2E Tester");
await p.fill("#email", "frontend-test@example.com");
await p.click("#comment-submit");
await p.waitForSelector(".comment-awaiting-moderation", { timeout: 15000 });
out.comment = (await p.textContent(".comment-awaiting-moderation"))?.trim();

// quick view
await p.goto(BASE + "/shop-2/", { waitUntil: "networkidle" });
await p.hover("ul.products li.product >> nth=0");
await p.locator("ul.products li.product .image-wrap .owp-quick-view").first().evaluate((el) => el.click());
await p.waitForSelector("#owp-qv-content .product_title", { timeout: 10000 });
out.quickView = (await p.textContent("#owp-qv-content .product_title"))?.trim();
await p.click(".owp-qv-close");
// sorting
await p.selectOption("select.orderby", "date");
await p.waitForURL(/orderby=date/);
out.sortUrl = p.url().replace(BASE, "");
// sticky header
await p.mouse.wheel(0, 800); await p.waitForTimeout(400);
out.sticky = await p.evaluate(() => document.getElementById("mysticky-nav")?.classList.contains("wrapfixed"));
// header search dropdown
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
await p.click(".search-dropdown-toggle");
out.searchDropdown = await p.evaluate(() => document.getElementById("searchform-dropdown")?.classList.contains("show"));
await p.fill("#ocean-search-form-1", "高粱");
await p.press("#ocean-search-form-1", "Enter");
await p.waitForURL(/\?s=/);
out.searchTitle = (await p.textContent(".page-header-title"))?.trim();

// mobile menu
const m = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(BASE + "/", { waitUntil: "networkidle" });
await mp.click(".mobile-menu");
await mp.waitForTimeout(300);
out.mobileMenu = await mp.locator("#mobile-dropdown").isVisible();
await mp.screenshot({ path: path.join(SHOT, "e2e_mobile_menu.png") });
log(JSON.stringify(out, null, 1));
await b.close();
