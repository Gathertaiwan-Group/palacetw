import Link from "next/link";
import { listMedia } from "@/lib/admin/media";
import { uploadMediaAction } from "../../actions";
import { Notice, Pager, one, pageOf, type SP } from "@/components/admin/ui";

export const metadata = { title: "媒體庫" };

export default async function MediaLib({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { limit, offset } = pageOf(sp, 60);
  const res = await listMedia({ search: one(sp.s), mime: one(sp.mime) || undefined, limit, offset });
  return (
    <>
      <h1>媒體庫</h1>
      <Notice sp={sp} />
      <form action={uploadMediaAction} className="card">
        <h2>上傳新媒體</h2>
        <p className="muted">圖片會自動轉成 WebP（最長邊 2000px、品質 80）；GIF、影片、PDF 保留原檔。單檔上限 20MB（線上環境單次請求上限約 4.5MB）。</p>
        <input type="file" name="files" multiple accept="image/*,application/pdf,video/*" required />
        <button className="btn btn-p" style={{ marginLeft: 8 }}>上傳</button>
      </form>
      <form className="filters" method="get" action="/admin/media/">
        <select name="mime" defaultValue={one(sp.mime)}><option value="">所有類型</option><option value="image">圖片</option><option value="video">影片</option><option value="application/pdf">PDF</option></select>
        <input type="search" name="s" defaultValue={one(sp.s)} placeholder="搜尋媒體" />
        <button className="btn">篩選</button>
      </form>
      <Pager base="/admin/media/" sp={sp} total={res.total} limit={limit} offset={offset} />
      <div className="mgrid">
        {res.items.map((m: any) => (
          <Link key={m.id} href={`/admin/media/${m.id}/`} title={m.title}>
            {m.mime_type.startsWith("image/") ? <img src={m.public_url} alt={m.alt_text} loading="lazy" /> : <span style={{ display: "block", padding: "48px 0" }}>{m.mime_type}</span>}
            <span className="fname">{m.title || m.storage_path}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
