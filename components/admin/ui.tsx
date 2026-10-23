import Link from "next/link";

export type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export function Notice({ sp }: { sp: SP }) {
  const msg = one(sp.msg);
  const err = one(sp.err);
  return <>{msg ? <div className="notice">{msg}</div> : null}{err ? <div className="notice err">{err}</div> : null}</>;
}

const LABELS: Record<string, string> = {
  publish: "已發布", draft: "草稿", pending: "待審", private: "私密", future: "排程", trash: "回收桶",
  processing: "處理中", "on-hold": "保留", completed: "已完成", cancelled: "已取消", refunded: "已退款", failed: "失敗", "checkout-draft": "結帳草稿",
  approved: "已核准", hold: "待審核", spam: "垃圾", unread: "未讀", read: "已讀", instock: "有庫存", outofstock: "缺貨", onbackorder: "預購",
};
export const statusLabel = (s: string) => LABELS[s] || s;
export function Badge({ s }: { s: string }) {
  return <span className={`badge st-${s}`}>{statusLabel(s)}</span>;
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}

/** ISO → value for <input type="datetime-local"> in Asia/Taipei */
export function toLocalInput(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(new Date(v).getTime() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
}

export function money(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return "NT$" + Number(v).toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

export function Pager({ base, sp, total, limit, offset }: { base: string; sp: SP; total: number; limit: number; offset: number }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const cur = Math.floor(offset / limit) + 1;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "p" && k !== "msg" && k !== "err" && one(v)) q.set(k, one(v));
    if (p > 1) q.set("p", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  return (
    <div className="pager">
      <span className="muted">共 {total} 項</span>
      {cur > 1 ? <Link className="btn btn-s" href={href(cur - 1)}>‹ 上一頁</Link> : null}
      <span>{cur} / {pages}</span>
      {cur < pages ? <Link className="btn btn-s" href={href(cur + 1)}>下一頁 ›</Link> : null}
    </div>
  );
}

export function pageOf(sp: SP, limit: number) {
  const p = Math.max(1, Number(one(sp.p)) || 1);
  return { limit, offset: (p - 1) * limit };
}
