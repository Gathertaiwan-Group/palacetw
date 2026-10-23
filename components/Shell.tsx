import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { getIndex, setting, type SiteIndex } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import ThemeBehaviors from "./ThemeBehaviors";
import CartCount from "./CartCount";
import QuickView from "./QuickView";
import MiniCart from "./MiniCart";

export type Crumb = { label: string; href?: string };

export const BASE_BODY =
  "wp-embed-responsive wp-theme-oceanwp theme-oceanwp woocommerce-js oceanwp-theme dropdown-mobile default-breakpoint";
export const TAIL_BODY = "has-breadcrumbs has-blog-grid has-grid-list account-original-style elementor-default elementor-kit-1136";

/** Layout classes from the OceanWP page settings on the old site. */
export const LAYOUT = {
  fullScreen: "content-full-screen",
  fullWidth: "content-full-width content-max-width",
  both: "has-sidebar content-both-sidebars scs-style",
  right: "has-sidebar content-right-sidebar",
  left: "has-sidebar content-left-sidebar",
};

function menuItems(ix: SiteIndex) {
  const pm = setting<{ menu_id?: number }>(ix, "primary_menu", {});
  return ix.menuItems.filter((m) => !pm.menu_id || m.menu_id === pm.menu_id).filter((m) => !m.parent_id);
}

function Header({ ix, isHome }: { ix: SiteIndex; isHome: boolean }) {
  const items = menuItems(ix);
  const name = setting<string>(ix, "blogname", SITE_NAME);
  const logo = setting<{ url?: string | null }>(ix, "site_logo", {}).url; // set from /admin/settings
  const homeCls = isHome ? " current-menu-item current_page_item" : "";
  return (
    <div id="mysticky-wrap">
      <div id="mysticky-nav">
        <header id="site-header" className="minimal-header center-logo clr" data-height="100" itemScope itemType="https://schema.org/WPHeader" role="banner">
          <div id="site-header-inner" className="clr container">
            <div className="oceanwp-mobile-menu-icon clr woo-menu-icon mobile-left">
              <Link href="/cart-2/" className="wcmenucart">
                <span className="wcmenucart-count"><i className=" icon-handbag" aria-hidden="true" role="img" /><CartCount /></span>
              </Link>
            </div>
            <div id="site-logo" className="clr" itemScope itemType="https://schema.org/Brand">
              <div id="site-logo-inner" className="clr">
                {logo ? <Link href="/" rel="home" className="custom-logo-link"><img src={logo} className="custom-logo" alt={name} /></Link> : <Link href="/" rel="home" className="site-title site-logo-text">{name}</Link>}
              </div>
            </div>
            <div id="site-navigation-wrap" className="clr">
              <nav id="site-navigation" className="navigation main-navigation clr" itemScope itemType="https://schema.org/SiteNavigationElement" role="navigation">
                <ul id="menu-menu2" className="main-menu dropdown-menu sf-menu">
                  {items.map((m) => (
                    <li key={m.id} id={`menu-item-${m.id}`} className={`menu-item menu-item-type-custom menu-item-object-custom${homeCls} menu-item-home menu-item-${m.id}`}>
                      <a href={m.url || "#"} className="menu-link" target={m.target || undefined}><span className="text-wrap">{m.title}</span></a>
                    </li>
                  ))}
                  <li className="woo-menu-icon wcmenucart-toggle-drop_down toggle-cart-widget">
                    <Link href="/cart-2/" className="wcmenucart">
                      <span className="wcmenucart-count"><i className=" icon-handbag" aria-hidden="true" role="img" /><CartCount /></span>
                    </Link>
                    <div className="current-shop-items-dropdown owp-mini-cart clr">
                      <div className="current-shop-items-inner clr">
                        <div className="widget woocommerce widget_shopping_cart"><div className="widget_shopping_cart_content"><MiniCart /></div></div>
                      </div>
                    </div>
                  </li>
                  <li className="search-toggle-li">
                    <a href="#" className="site-search-toggle search-dropdown-toggle" aria-label="Search website"><i className=" icon-magnifier" aria-hidden="true" role="img" /></a>
                  </li>
                </ul>
                <div id="searchform-dropdown" className="header-searchform-wrap clr">
                  <form role="search" method="get" className="searchform" action="/">
                    <label htmlFor="ocean-search-form-1">
                      <span className="screen-reader-text">Search this website</span>
                      <input type="search" id="ocean-search-form-1" className="field" autoComplete="off" placeholder="Search" name="s" />
                    </label>
                  </form>
                </div>
              </nav>
            </div>
            <div className="oceanwp-mobile-menu-icon clr mobile-right">
              <a href="#" className="mobile-menu" aria-label="Mobile Menu">
                <div className="hamburger hamburger--collapse" aria-expanded="false" role="navigation">
                  <div className="hamburger-box"><div className="hamburger-inner" /></div>
                </div>
              </a>
            </div>
          </div>
          <div id="mobile-dropdown" className="clr">
            <nav className="clr" itemScope itemType="https://schema.org/SiteNavigationElement">
              <div id="mobile-nav" className="navigation clr">
                <ul id="menu-menu2-1" className="menu">
                  {items.map((m) => (
                    <li key={m.id} className={`menu-item menu-item-type-custom menu-item-object-custom${homeCls} menu-item-home menu-item-${m.id}`}>
                      <a href={m.url || "#"}>{m.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div id="mobile-menu-search" className="clr">
                <form aria-label="Search this website" method="get" action="/" className="mobile-searchform" role="search">
                  <input aria-label="Insert search query" defaultValue="" className="field" id="ocean-mobile-search-2" type="search" name="s" autoComplete="off" placeholder="Search" />
                  <button aria-label="Submit search" type="submit" className="searchform-submit"><i className=" icon-magnifier" aria-hidden="true" role="img" /></button>
                </form>
              </div>
            </nav>
          </div>
        </header>
      </div>
    </div>
  );
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <div className="site-breadcrumbs clr">
      <Link href="/">首頁</Link>
      {crumbs.map((c, i) => (
        <Fragment key={i}>
          <span className="separator"> &raquo; </span>
          {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span className="last">{c.label}</span>}
        </Fragment>
      ))}
    </div>
  );
}

export function PageHeader({ title, crumbs, subheading }: { title: string; crumbs?: Crumb[]; subheading?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="container clr page-header-inner">
        <h1 className="page-header-title clr" itemProp="headline">{title}</h1>
        {subheading ? <div className="clr page-subheading">{subheading}</div> : null}
        {crumbs ? <Breadcrumbs crumbs={crumbs} /> : null}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer id="footer" className="site-footer" itemScope itemType="https://schema.org/WPFooter" role="contentinfo">
      <div id="footer-inner" className="clr">
        <div id="footer-bottom" className="clr no-footer-nav">
          <div id="footer-bottom-inner" className="container clr">
            <div id="copyright" className="clr" role="contentinfo">
              台灣宮廷酒廠國際企業股份有限公司版權所有　Copyright © TAIWAN PALACE LIQUOR INTERNATIONAL INC. All Rights Reserved.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function EmptySidebar({ side }: { side: "left" | "right" }) {
  const id = side === "left" ? "left-sidebar" : "right-sidebar";
  return (
    <aside id={id} className={`sidebar-container widget-area ${side === "left" ? "sidebar-secondary" : "sidebar-primary"}`} itemScope itemType="https://schema.org/WPSideBar" role="complementary" aria-label={side === "left" ? "Secondary Sidebar" : "Primary Sidebar"}>
      <div id={`${id}-inner`} className="clr" />
    </aside>
  );
}

/** The "secondary" (left) sidebar widgets shown on cart / checkout / my-account. */
export async function WidgetSidebar() {
  const ix = await getIndex();
  const cats = ix.terms.filter((t) => t.taxonomy === "category").sort((a, b) => a.name.localeCompare(b.name));
  const months = Array.from(new Set(ix.posts.filter((p) => p.post_type === "post" && p.status === "publish" && p.date_local).map((p) => p.date_local!.slice(0, 7)))).sort().reverse();
  return (
    <aside id="left-sidebar" className="sidebar-container widget-area sidebar-secondary" itemScope itemType="https://schema.org/WPSideBar" role="complementary" aria-label="Secondary Sidebar">
      <div id="left-sidebar-inner" className="clr">
        <div id="archives-2" className="sidebar-box widget_archive clr">
          <h4 className="widget-title">彙整</h4>
          <ul>{months.map((m) => <li key={m}><Link href={`/${m.slice(0, 4)}/${m.slice(5, 7)}/`}>{`${m.slice(0, 4)} 年 ${Number(m.slice(5, 7))} 月`}</Link></li>)}</ul>
        </div>
        <div id="categories-2" className="sidebar-box widget_categories clr">
          <h4 className="widget-title">分類</h4>
          <ul>{cats.map((c) => <li key={c.id} className={`cat-item cat-item-${c.id}`}><Link href={`/category/${c.slug}/`}>{c.name}</Link></li>)}</ul>
        </div>
        <div id="meta-2" className="sidebar-box widget_meta clr">
          <h4 className="widget-title">其他操作</h4>
          <ul>
            <li><Link rel="nofollow" href="/my-account/">登入</Link></li>
            <li><a href="/feed/">訂閱網站內容的資訊提供</a></li>
            <li><a href="/comments/feed/">訂閱留言的資訊提供</a></li>
            <li><a href="https://tw.wordpress.org/">WordPress.org 台灣繁體中文</a></li>
          </ul>
        </div>
      </div>
    </aside>
  );
}

export default async function Shell({
  bodyClass, children, header, isHome = false, floatingBar,
}: { bodyClass: string; children: ReactNode; header?: ReactNode; isHome?: boolean; floatingBar?: ReactNode }) {
  const ix = await getIndex();
  return (
    <div className={`wpb ${bodyClass}`} itemScope itemType="https://schema.org/WebPage">
      <div id="outer-wrap" className="site clr">
        <a className="skip-link screen-reader-text" href="#main">Skip to content</a>
        <div id="wrap" className="clr">
          <Header ix={ix} isHome={isHome} />
          {floatingBar}
          <main id="main" className="site-main clr" role="main">
            {header}
            {children}
          </main>
          <Footer />
        </div>
      </div>
      <a aria-label="Scroll to the top of the page" href="#" id="scroll-top" className="scroll-top-right"><i className=" fa fa-angle-up" aria-hidden="true" role="img" /></a>
      <QuickView />
      <div id="oceanwp-cart-sidebar-wrap"><div className="oceanwp-cart-sidebar"><a href="#" className="oceanwp-cart-close">×</a><p className="owp-cart-title">Cart</p><div className="divider" /><div className="owp-mini-cart"><div className="widget woocommerce widget_shopping_cart"><div className="widget_shopping_cart_content"><MiniCart /></div></div></div></div><div className="oceanwp-cart-sidebar-overlay" /></div>
      <ThemeBehaviors />
    </div>
  );
}

/** Standard page wrapper: #content-wrap > #primary > #content */
export function ContentWrap({ children, sidebars, contentClass = "site-content clr" }: { children: ReactNode; sidebars?: ReactNode; contentClass?: string }) {
  return (
    <div id="content-wrap" className="container clr">
      <div id="primary" className="content-area clr">
        <div id="content" className={contentClass}>{children}</div>
      </div>
      {sidebars}
    </div>
  );
}
