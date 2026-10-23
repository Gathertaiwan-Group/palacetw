"use client";
import { useCallback, useEffect, useState } from "react";

export type MediaItem = { id: number; title: string; public_url: string; mime_type: string; width: number | null; height: number | null; alt_text: string };

/** Modal listing the media library; calls onPick with the chosen item. */
export function MediaDialog({ onPick, onClose, mime = "image" }: { onPick: (m: MediaItem) => void; onClose: () => void; mime?: string }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(true);
  const [uploadMsg, setUploadMsg] = useState("");
  const load = useCallback(async (off: number, search: string) => {
    setBusy(true);
    const r = await fetch(`/admin/media-json/?s=${encodeURIComponent(search)}&mime=${encodeURIComponent(mime)}&offset=${off}`, { cache: "no-store" });
    const j = await r.json();
    setItems(j.items || []); setTotal(j.total || 0); setOffset(off); setBusy(false);
  }, [mime]);
  useEffect(() => {
    let live = true;
    fetch(`/admin/media-json/?s=&mime=${encodeURIComponent(mime)}&offset=0`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (live) { setItems(j.items || []); setTotal(j.total || 0); setBusy(false); } });
    return () => { live = false; };
  }, [mime]);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadMsg("上傳中…");
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const r = await fetch("/admin/media-upload/", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setUploadMsg(r.ok ? `已上傳 ${j.items?.length || 0} 個檔案` : j.error || "上傳失敗");
    await load(0, q);
  };
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="filters">
          <strong>媒體庫</strong>
          <input type="search" placeholder="搜尋媒體" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void load(0, q); } }} />
          <button type="button" className="btn" onClick={() => load(0, q)}>搜尋</button>
          <label className="btn" style={{ margin: 0, fontWeight: 400 }}>上傳檔案<input type="file" multiple hidden accept="image/*,application/pdf,video/*" onChange={(e) => upload(e.target.files)} /></label>
          <span className="muted">{uploadMsg}</span>
          <button type="button" className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>關閉</button>
        </div>
        {busy ? <p className="muted">載入中…</p> : null}
        <div className="mgrid">
          {items.map((m) => (
            <button type="button" key={m.id} className="mi" onClick={() => onPick(m)} title={m.title}>
              {m.mime_type.startsWith("image/") ? <img src={m.public_url} alt={m.alt_text} loading="lazy" /> : <span style={{ display: "block", padding: "40px 0" }}>{m.mime_type}</span>}
              <span className="fname">#{m.id} {m.title}</span>
            </button>
          ))}
        </div>
        <div className="pager">
          <span className="muted">共 {total} 項</span>
          {offset > 0 ? <button type="button" className="btn btn-s" onClick={() => load(Math.max(0, offset - 60), q)}>‹ 上一頁</button> : null}
          {offset + 60 < total ? <button type="button" className="btn btn-s" onClick={() => load(offset + 60, q)}>下一頁 ›</button> : null}
        </div>
      </div>
    </div>
  );
}

/** Form field holding a media ID (featured image, logo …) with preview. */
export function MediaField({ name, initialId, initialUrl, label = "設定圖片" }: { name: string; initialId: number | null; initialUrl: string | null; label?: string }) {
  const [id, setId] = useState<number | null>(initialId);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <input type="hidden" name={name} value={id ?? ""} />
      {url ? <img src={url} alt="" style={{ maxWidth: "100%", maxHeight: 180, display: "block", marginBottom: 6, border: "1px solid #dcdcde" }} /> : null}
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>{id ? "更換圖片" : label}</button>
      {id ? <> · <button type="button" className="linkbtn del" onClick={() => { setId(null); setUrl(null); }}>移除</button> <span className="muted">#{id}</span></> : null}
      {open ? <MediaDialog onClose={() => setOpen(false)} onPick={(m) => { setId(m.id); setUrl(m.public_url); setOpen(false); }} /> : null}
    </div>
  );
}

/** Ordered list of media IDs (product gallery). */
export function GalleryField({ name, initial }: { name: string; initial: { id: number; url: string }[] }) {
  const [list, setList] = useState(initial);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <input type="hidden" name={name} value={list.map((m) => m.id).join(",")} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {list.map((m, i) => (
          <div key={`${m.id}-${i}`} style={{ position: "relative" }}>
            <img src={m.url} alt="" className="thumb" />
            <button type="button" className="linkbtn del" style={{ position: "absolute", top: -6, right: -4, background: "#fff", borderRadius: 8, padding: "0 4px" }} onClick={() => setList(list.filter((_, k) => k !== i))}>×</button>
          </div>
        ))}
      </div>
      <button type="button" className="linkbtn" onClick={() => setOpen(true)}>新增商品圖庫圖片</button>
      {open ? <MediaDialog onClose={() => setOpen(false)} onPick={(m) => { setList([...list, { id: m.id, url: m.public_url }]); setOpen(false); }} /> : null}
    </div>
  );
}
