"use client";
import { useState } from "react";

type Row = { key: string; parent_key: string | null; title: string; url: string; target: string; classes: string };

/** Menu items editor: order with ↑↓, nest with → ←. Serialises to items_json for the menu form. */
export default function MenuEditor({ initial, pages }: { initial: any[]; pages: { title: string; path: string }[] }) {
  const byId = new Map(initial.map((i) => [i.id, i]));
  const order: any[] = [];
  const walk = (pid: number | null) => initial.filter((i) => (i.parent_id ?? null) === pid || (pid === null && i.parent_id && !byId.has(i.parent_id))).sort((a, b) => a.position - b.position).forEach((i) => { if (!order.includes(i)) { order.push(i); walk(i.id); } });
  walk(null);
  const [rows, setRows] = useState<Row[]>(order.map((i) => ({ key: String(i.id), parent_key: i.parent_id && byId.has(i.parent_id) ? String(i.parent_id) : null, title: i.title, url: i.url || "", target: i.target || "", classes: (i.classes || []).join(" ") })));
  const depth = (r: Row): number => (r.parent_key ? 1 + depth(rows.find((x) => x.key === r.parent_key) || { ...r, parent_key: null }) : 0);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const n = [...rows];
    [n[i], n[j]] = [n[j], n[i]];
    // a child may not be placed before its parent
    n.forEach((r, k) => { if (r.parent_key && n.findIndex((x) => x.key === r.parent_key) > k) r.parent_key = null; });
    setRows(n);
  };
  const indent = (i: number) => { if (i > 0) set(i, { parent_key: rows[i - 1].key }); };
  const outdent = (i: number) => { const p = rows.find((x) => x.key === rows[i].parent_key); set(i, { parent_key: p?.parent_key ?? null }); };
  const remove = (i: number) => { const k = rows[i].key; setRows(rows.filter((_, x) => x !== i).map((r) => (r.parent_key === k ? { ...r, parent_key: null } : r))); };
  const add = (title = "", url = "") => setRows([...rows, { key: `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`, parent_key: null, title, url, target: "", classes: "" }]);
  const json = JSON.stringify(rows.map((r) => ({ key: r.key, parent_key: r.parent_key, title: r.title, url: r.url || null, target: r.target || null, classes: r.classes.split(/\s+/).filter(Boolean) })));
  return (
    <div>
      <input type="hidden" name="items_json" value={json} />
      <div className="menu-row muted" style={{ background: "none", border: 0 }}><span /><span>導覽標籤</span><span>網址</span><span>開啟方式</span><span>CSS class</span><span /></div>
      {rows.map((r, i) => (
        <div key={r.key} className="menu-row" style={{ marginLeft: depth(r) * 28 }}>
          <span className="muted">{i + 1}</span>
          <input type="text" value={r.title} onChange={(e) => set(i, { title: e.target.value })} aria-label="導覽標籤" required />
          <input type="text" value={r.url} onChange={(e) => set(i, { url: e.target.value })} aria-label="網址" placeholder="/path/ 或 https://" />
          <select value={r.target} onChange={(e) => set(i, { target: e.target.value })} aria-label="開啟方式"><option value="">同視窗</option><option value="_blank">新分頁</option></select>
          <input type="text" value={r.classes} onChange={(e) => set(i, { classes: e.target.value })} aria-label="CSS class" />
          <span style={{ whiteSpace: "nowrap" }}>
            <button type="button" className="btn btn-s" onClick={() => move(i, -1)} title="上移">↑</button>
            <button type="button" className="btn btn-s" onClick={() => move(i, 1)} title="下移">↓</button>
            <button type="button" className="btn btn-s" onClick={() => indent(i)} title="變成上一項的子項目">→</button>
            <button type="button" className="btn btn-s" onClick={() => outdent(i)} title="移出一層">←</button>
            <button type="button" className="btn btn-s btn-d" onClick={() => remove(i)} title="移除">×</button>
          </span>
        </div>
      ))}
      <div className="actions">
        <button type="button" className="btn" onClick={() => add()}>新增自訂連結</button>
        <select defaultValue="" onChange={(e) => { const p = pages.find((x) => x.path === e.target.value); if (p) add(p.title, p.path); e.target.value = ""; }} style={{ width: "auto" }}>
          <option value="">新增頁面／分類…</option>
          {pages.map((p) => <option key={p.path} value={p.path}>{p.title}</option>)}
        </select>
      </div>
    </div>
  );
}
