"use client";
import { useEffect, useRef, useState } from "react";
import { MediaDialog } from "./MediaPicker";

/**
 * WYSIWYG editor (contentEditable) with an HTML source view. contentEditable keeps arbitrary markup
 * (Elementor sections, embeds, classes) intact, which a schema-based editor would strip.
 * The current HTML is mirrored into a hidden <input name={name}> for the surrounding <form>.
 */
function ToolBtn({ c, v, label, title, onCmd }: { c: string; v?: string; label: string; title: string; onCmd: (c: string, v?: string) => void }) {
  return <button type="button" title={title} onMouseDown={(e) => e.preventDefault()} onClick={() => onCmd(c, v)}>{label}</button>;
}

export default function RichEditor({ name, initial, minHeight = 420 }: { name: string; initial: string; minHeight?: number }) {
  const area = useRef<HTMLDivElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [src, setSrc] = useState(initial);
  const [picking, setPicking] = useState(false);
  const saved = useRef<Range | null>(null);

  useEffect(() => {
    if (area.current) area.current.innerHTML = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    if (mode === "visual" && area.current && hidden.current) hidden.current.value = area.current.innerHTML;
  };
  const remember = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && area.current?.contains(sel.anchorNode)) saved.current = sel.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    area.current?.focus();
    const sel = window.getSelection();
    if (saved.current && sel) { sel.removeAllRanges(); sel.addRange(saved.current); }
  };
  const cmd = (c: string, v?: string) => {
    restore();
    document.execCommand(c, false, v);
    sync();
    remember();
  };
  const toggle = () => {
    if (mode === "visual") {
      const html = area.current?.innerHTML ?? "";
      setSrc(html);
      setMode("html");
    } else {
      if (area.current) area.current.innerHTML = src;
      if (hidden.current) hidden.current.value = src;
      setMode("visual");
    }
  };
  const link = () => {
    const url = window.prompt("連結網址（留空＝移除連結）", "https://");
    if (url === null) return;
    if (!url || url === "https://") cmd("unlink");
    else cmd("createLink", url);
  };
  return (
    <div className="re">
      <input type="hidden" name={name} ref={hidden} defaultValue={initial} />
      <div className="re-bar">
        {mode === "visual" ? (
          <>
            <select aria-label="段落格式" defaultValue="" onMouseDown={remember} onChange={(e) => { if (e.target.value) cmd("formatBlock", e.target.value); e.target.value = ""; }}>
              <option value="">段落格式</option>
              <option value="<p>">段落</option>
              <option value="<h2>">標題 2</option>
              <option value="<h3>">標題 3</option>
              <option value="<h4>">標題 4</option>
              <option value="<blockquote>">引言</option>
              <option value="<pre>">預先格式化</option>
            </select>
            <ToolBtn c="bold" label="B" title="粗體" onCmd={cmd} />
            <ToolBtn c="italic" label="I" title="斜體" onCmd={cmd} />
            <ToolBtn c="underline" label="U" title="底線" onCmd={cmd} />
            <ToolBtn c="strikeThrough" label="S" title="刪除線" onCmd={cmd} />
            <ToolBtn c="insertUnorderedList" label="• 清單" title="項目清單" onCmd={cmd} />
            <ToolBtn c="insertOrderedList" label="1. 清單" title="編號清單" onCmd={cmd} />
            <ToolBtn c="justifyLeft" label="靠左" title="靠左對齊" onCmd={cmd} />
            <ToolBtn c="justifyCenter" label="置中" title="置中對齊" onCmd={cmd} />
            <ToolBtn c="justifyRight" label="靠右" title="靠右對齊" onCmd={cmd} />
            <button type="button" title="插入連結" onMouseDown={(e) => e.preventDefault()} onClick={link}>連結</button>
            <button type="button" title="從媒體庫插入圖片" onMouseDown={(e) => { e.preventDefault(); remember(); }} onClick={() => setPicking(true)}>圖片</button>
            <ToolBtn c="insertHorizontalRule" label="―" title="分隔線" onCmd={cmd} />
            <ToolBtn c="removeFormat" label="清除格式" title="清除格式" onCmd={cmd} />
            <ToolBtn c="undo" label="↶" title="復原" onCmd={cmd} />
            <ToolBtn c="redo" label="↷" title="重做" onCmd={cmd} />
          </>
        ) : <span className="muted" style={{ padding: "4px 6px" }}>HTML 原始碼</span>}
        <button type="button" className={mode === "html" ? "on" : ""} style={{ marginLeft: "auto" }} onClick={toggle}>{mode === "visual" ? "</> HTML" : "視覺編輯"}</button>
      </div>
      <div
        ref={area}
        className="re-area"
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight, display: mode === "visual" ? "block" : "none" }}
        onInput={sync}
        onBlur={() => { sync(); remember(); }}
        onKeyUp={remember}
        onMouseUp={remember}
      />
      {mode === "html" ? (
        <textarea className="re-src" style={{ minHeight }} value={src} onChange={(e) => { setSrc(e.target.value); if (hidden.current) hidden.current.value = e.target.value; }} />
      ) : null}
      {picking ? (
        <MediaDialog
          onClose={() => setPicking(false)}
          onPick={(m) => {
            setPicking(false);
            const alt = (m.alt_text || m.title || "").replace(/"/g, "&quot;");
            const tag = m.mime_type.startsWith("image/")
              ? `<img src="${m.public_url}" alt="${alt}"${m.width ? ` width="${m.width}" height="${m.height}"` : ""} class="wp-image-${m.id}" />`
              : `<a href="${m.public_url}">${m.title}</a>`;
            setTimeout(() => cmd("insertHTML", tag), 0);
          }}
          mime=""
        />
      ) : null}
    </div>
  );
}
