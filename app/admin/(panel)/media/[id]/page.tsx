import Link from "next/link";
import { notFound } from "next/navigation";
import { getMedia } from "@/lib/admin/media";
import { sb } from "@/lib/admin/core";
import { updateMediaAction, deleteMediaAction } from "../../../actions";
import { Notice, fmtDate, type SP } from "@/components/admin/ui";

export const metadata = { title: "媒體" };

export default async function MediaItem({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const m = await getMedia(Number(id)).catch(() => null);
  if (!m) notFound();
  const { data: used } = await sb().from("posts").select("id,title,post_type").eq("featured_media_id", m.id).limit(20);
  const kb = (n: number | null) => (n ? `${Math.round(n / 1024)} KB` : "—");
  return (
    <>
      <h1>編輯媒體 <Link className="btn" href="/admin/media/">← 媒體庫</Link></h1>
      <Notice sp={sp} />
      <div className="grid2">
        <div className="card" style={{ textAlign: "center" }}>
          {m.mime_type.startsWith("image/") ? <img src={m.public_url} alt={m.alt_text} style={{ maxWidth: "100%", maxHeight: "70vh" }} /> : m.mime_type.startsWith("video/") ? <video src={m.public_url} controls style={{ maxWidth: "100%" }} /> : <a href={m.public_url}>{m.public_url}</a>}
        </div>
        <div>
          <form action={updateMediaAction} className="card">
            <input type="hidden" name="id" value={m.id} />
            <label>標題</label><input type="text" name="title" defaultValue={m.title} />
            <label>替代文字（alt）</label><input type="text" name="alt_text" defaultValue={m.alt_text} />
            <label>說明文字（caption）</label><textarea name="caption" rows={2} defaultValue={m.caption} />
            <label>描述</label><textarea name="description" rows={2} defaultValue={m.description} />
            <label>檔案網址</label><input type="text" readOnly value={m.public_url} />
            <div className="actions"><button className="btn btn-p">更新</button></div>
          </form>
          <div className="card">
            <p className="muted">ID {m.id} · {m.mime_type}{m.original_mime && m.original_mime !== m.mime_type ? `（原 ${m.original_mime}）` : ""}<br />
              {m.width ? `${m.width} × ${m.height} · ` : ""}{kb(m.filesize)}{m.original_filesize ? `（原 ${kb(m.original_filesize)}）` : ""}<br />
              上傳：{fmtDate(m.uploaded_at || m.created_at)}<br />路徑：{m.storage_path}{m.old_url ? <><br />舊網址：{m.old_url}</> : null}</p>
            {used?.length ? <p>作為精選圖片：{used.map((u: any) => <Link key={u.id} href={u.post_type === "product" ? `/admin/products/${u.id}/` : `/admin/posts/${u.id}/`} style={{ marginRight: 6 }}>{u.title}</Link>)}</p> : null}
            <form action={deleteMediaAction}><input type="hidden" name="id" value={m.id} /><button className="btn btn-d">永久刪除</button></form>
          </div>
        </div>
      </div>
    </>
  );
}
