"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const NAV: ([string, string] | string)[] = [
  ["/admin/", "控制台"],
  "內容",
  ["/admin/posts/?type=post", "文章"],
  ["/admin/posts/?type=page", "頁面"],
  ["/admin/posts/?type=ocean_modal_window", "彈出視窗"],
  ["/admin/terms/?taxonomy=category", "文章分類／標籤"],
  ["/admin/media/", "媒體庫"],
  ["/admin/comments/", "留言"],
  "商店",
  ["/admin/products/", "商品"],
  ["/admin/terms/?taxonomy=product_cat", "商品分類／標籤"],
  ["/admin/orders/", "訂單"],
  ["/admin/customers/", "顧客"],
  ["/admin/coupons/", "優惠券"],
  ["/admin/discounts/", "數量折扣"],
  "外觀與設定",
  ["/admin/menus/", "選單"],
  ["/admin/forms/", "表單提交"],
  ["/admin/settings/", "網站設定"],
  ["/admin/redirects/", "轉址管理"],
  ["/admin/audit/", "稽核紀錄"],
];

export default function Nav() {
  const path = usePathname() || "";
  const sp = useSearchParams();
  const active = (href: string) => {
    const [p, q] = href.split("?");
    if (p === "/admin/") return path === "/admin" || path === "/admin/";
    if (!path.startsWith(p.replace(/\/$/, ""))) return false;
    if (!q) return true;
    const [k, v] = q.split("=");
    const cur = sp.get(k);
    if (k === "taxonomy") return (cur || "category").startsWith(v.split("_")[0]) && (v.startsWith("product") === (cur || "").startsWith("product"));
    return cur === v || (!cur && v === "post");
  };
  return (
    <nav>
      {NAV.map((n, i) => typeof n === "string" ? <div key={i} className="grp">{n}</div> : <Link key={n[0]} href={n[0]} className={active(n[0]) ? "on" : ""}>{n[1]}</Link>)}
    </nav>
  );
}
