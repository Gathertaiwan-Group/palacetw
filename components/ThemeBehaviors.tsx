"use client";
// Re-implements the jQuery behaviours of the old OceanWP / mystickymenu / Elementor front-end
// (sticky header, search dropdown, mobile menu, scroll-to-top, entrance animations, shop toolbar, tabs).
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ThemeBehaviors() {
  const pathname = usePathname();

  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const on = (el: Element | Window | Document | null, ev: string, fn: (e: any) => void, opts?: any) => {
      if (!el) return;
      el.addEventListener(ev, fn, opts);
      cleanups.push(() => el.removeEventListener(ev, fn, opts));
    };

    /* sticky header (mystickymenu: activationHeight 0, fade, desktop+mobile) */
    const wrap = document.getElementById("mysticky-wrap");
    const nav = document.getElementById("mysticky-nav");
    const header = document.getElementById("site-header");
    const floating = document.querySelector<HTMLElement>(".owp-floating-bar");
    const scrollTop = document.getElementById("scroll-top");
    const onScroll = () => {
      const y = window.scrollY;
      if (wrap && nav && header) {
        if (y > 0) {
          if (!nav.classList.contains("wrapfixed")) {
            wrap.style.height = header.offsetHeight + "px";
            nav.classList.add("wrapfixed");
            header.classList.add("myfixed");
          }
        } else if (nav.classList.contains("wrapfixed")) {
          nav.classList.remove("wrapfixed");
          header.classList.remove("myfixed");
          wrap.style.height = "";
        }
      }
      if (scrollTop) {
        if (y > 100) { scrollTop.style.display = "block"; scrollTop.style.opacity = "1"; }
        else { scrollTop.style.opacity = "0"; scrollTop.style.display = "none"; }
      }
      if (floating) {
        const summary = document.querySelector<HTMLElement>(".summary.entry-summary");
        const trigger = summary ? summary.getBoundingClientRect().bottom + window.scrollY : 600;
        floating.classList.toggle("show", y > trigger);
      }
    };
    onScroll();
    on(window, "scroll", onScroll, { passive: true });

    on(scrollTop, "click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); });

    /* header search dropdown */
    const toggle = document.querySelector(".search-dropdown-toggle");
    const dd = document.getElementById("searchform-dropdown");
    on(toggle, "click", (e) => {
      e.preventDefault();
      dd?.classList.toggle("show");
      toggle?.parentElement?.classList.toggle("active");
      if (dd?.classList.contains("show")) dd.querySelector("input")?.focus();
    });
    on(document, "click", (e) => {
      if (!dd || !toggle) return;
      const t = e.target as Node;
      if (!dd.contains(t) && !toggle.contains(t)) { dd.classList.remove("show"); toggle.parentElement?.classList.remove("active"); }
    });

    /* mobile dropdown menu */
    const mm = document.querySelector(".mobile-menu");
    const mdd = document.getElementById("mobile-dropdown");
    const ham = document.querySelector(".mobile-menu .hamburger");
    const closeMobile = () => { if (mdd) mdd.style.display = "none"; mm?.classList.remove("opened"); ham?.classList.remove("is-active"); ham?.setAttribute("aria-expanded", "false"); };
    on(mm, "click", (e) => {
      e.preventDefault();
      if (!mdd) return;
      const open = mdd.style.display === "block";
      if (open) closeMobile();
      else { mdd.style.display = "block"; mm?.classList.add("opened"); ham?.classList.add("is-active"); ham?.setAttribute("aria-expanded", "true"); }
    });
    mdd?.querySelectorAll("a").forEach((a) => on(a, "click", () => closeMobile()));

    /* mini cart dropdown */
    const cartLi = document.querySelector(".wcmenucart-toggle-drop_down");
    on(cartLi, "mouseenter", () => document.body.classList.add("show-cart"));
    on(cartLi, "mouseleave", () => document.body.classList.remove("show-cart"));

    /* Elementor entrance animations */
    const animated = Array.from(document.querySelectorAll<HTMLElement>(".elementor-invisible"));
    if (animated.length) {
      const io = new IntersectionObserver((entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const el = en.target as HTMLElement;
          let anim = "fadeIn";
          try { anim = JSON.parse(el.dataset.settings || "{}")._animation || anim; } catch {}
          el.classList.remove("elementor-invisible");
          el.classList.add("animated", anim);
          io.unobserve(el);
        }
      }, { rootMargin: "0px 0px -10% 0px" });
      animated.forEach((el) => io.observe(el));
      cleanups.push(() => io.disconnect());
    }

    /* shop toolbar: grid / list view + sorting */
    const gridBtn = document.getElementById("oceanwp-grid");
    const listBtn = document.getElementById("oceanwp-list");
    const setView = (v: "grid" | "list") => {
      document.querySelectorAll("ul.products").forEach((ul) => { ul.classList.toggle("grid", v === "grid"); ul.classList.toggle("list", v === "list"); });
      gridBtn?.classList.toggle("active", v === "grid");
      listBtn?.classList.toggle("active", v === "list");
      try { localStorage.setItem("pt-view", v); } catch {}
    };
    on(gridBtn, "click", (e) => { e.preventDefault(); setView("grid"); });
    on(listBtn, "click", (e) => { e.preventDefault(); setView("list"); });
    try { if (gridBtn && localStorage.getItem("pt-view") === "list") setView("list"); } catch {}
    document.querySelectorAll<HTMLSelectElement>("form.woocommerce-ordering select.orderby").forEach((sel) =>
      on(sel, "change", () => {
        // OceanWP customSelect: mirror the chosen option into the visible span, then submit
        const inner = sel.parentElement?.querySelector(".theme-selectInner");
        if (inner) inner.textContent = sel.options[sel.selectedIndex]?.text || "";
        sel.form?.submit();
      }),
    );

    /* WooCommerce tabs */
    const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>(".wc-tabs li a"));
    const showTab = (a: HTMLAnchorElement) => {
      tabs.forEach((x) => x.parentElement?.classList.remove("active"));
      a.parentElement?.classList.add("active");
      document.querySelectorAll<HTMLElement>(".woocommerce-Tabs-panel").forEach((p) => (p.style.display = "none"));
      const panel = document.querySelector<HTMLElement>(a.getAttribute("href") || "");
      if (panel) panel.style.display = "block";
    };
    tabs.forEach((a) => on(a, "click", (e) => { e.preventDefault(); showTab(a); }));
    if (tabs[0]) showTab(tabs[0]);

    /* floating bar button scrolls to the add-to-cart form */
    const fb = document.querySelector(".owp-floating-bar button");
    on(fb, "click", (e) => { e.preventDefault(); document.querySelector(".summary.entry-summary")?.scrollIntoView({ behavior: "smooth" }); });

    return () => cleanups.forEach((f) => f());
  }, [pathname]);

  return null;
}
