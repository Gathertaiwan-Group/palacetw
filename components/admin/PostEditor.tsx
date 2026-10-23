import Link from "next/link";
import type { ReactNode } from "react";
import RichEditor from "./RichEditor";
import { MediaField } from "./MediaPicker";
import { Badge, toLocalInput } from "./ui";
import { savePostAction, trashPostAction } from "@/app/admin/actions";

type Term = { id: number; name: string; parent_id: number | null };

function TermChecklist({ name, terms, selected }: { name: string; terms: Term[]; selected: Set<number> }) {
  const roots = terms.filter((t) => !t.parent_id || !terms.some((x) => x.id === t.parent_id));
  const render = (t: Term, depth: number): ReactNode => (
    <div key={t.id}>
      <label style={{ paddingLeft: depth * 16 }}><input type="checkbox" name={name} value={t.id} defaultChecked={selected.has(t.id)} /> {t.name}</label>
      {terms.filter((c) => c.parent_id === t.id).map((c) => render(c, depth + 1))}
    </div>
  );
  return <div className="checklist">{terms.length ? roots.map((t) => render(t, 0)) : <span className="muted">尚無項目</span>}</div>;
}

export default function PostEditor({
  post, type, typeLabel, cats, tags, catLabel, tagLabel, featuredUrl, parents, children, listHref,
}: {
  post: any | null; type: string; typeLabel: string; cats: Term[]; tags: Term[]; catLabel?: string; tagLabel?: string;
  featuredUrl: string | null; parents?: { id: number; title: string }[]; children?: ReactNode; listHref: string;
}) {
  const selected = new Set<number>((post?.terms || []).map((t: any) => t.id));
  const status: string = post?.status || "draft";
  const isPublished = status === "publish" || status === "private";
  const hasTax = cats.length > 0 || tags.length > 0 || type === "post" || type === "product";
  return (
    <form action={savePostAction}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="_back" value={listHref} />
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <div className="grid2">
        <div>
          <input className="title-input" type="text" name="title" defaultValue={post?.title || ""} placeholder="新增標題" aria-label="標題" />
          <div style={{ margin: "6px 0 12px", display: "flex", gap: 8, alignItems: "center" }}>
            <span className="muted">網址代稱</span>
            <input type="text" name="slug" defaultValue={post ? decodeURIComponent(post.slug) : ""} placeholder="留空將依標題自動產生" style={{ maxWidth: 360 }} />
            {post?.path && isPublished ? <a href={post.path} target="_blank" rel="noreferrer" className="muted">{decodeURIComponent(post.path)} ↗</a> : null}
          </div>
          <RichEditor name="content" initial={post?.content || ""} />
          {children}
          {type === "post" ? (
            <div className="card" style={{ marginTop: 16 }}>
              <h2>摘要</h2>
              <textarea name="excerpt" defaultValue={post?.excerpt || ""} rows={3} />
            </div>
          ) : null}
          <div className="card" style={{ marginTop: 16 }}>
            <h2>SEO（Rank Math）</h2>
            <label>SEO 標題</label>
            <input type="text" name="seo_title" defaultValue={post?.seo?.title || ""} placeholder="留空＝使用預設標題" />
            <label>Meta 描述</label>
            <textarea name="seo_description" rows={2} defaultValue={post?.seo?.description || ""} />
          </div>
        </div>
        <div>
          <div className="card">
            <h2>發布</h2>
            <p style={{ margin: "4px 0" }}>狀態：<Badge s={status} /> {post ? <span className="muted">ID {post.id}</span> : null}</p>
            <label htmlFor="date">發布時間（台北）</label>
            <input id="date" type="datetime-local" name="date" defaultValue={toLocalInput(post?.published_at)} />
            <p className="muted" style={{ margin: "4px 0" }}>設定未來時間並按「排程」即可預約發布。</p>
            <label htmlFor="visibility">可見度</label>
            <select id="visibility" name="visibility" defaultValue={status === "private" ? "private" : "public"}>
              <option value="public">公開</option>
              <option value="private">私密</option>
            </select>
            <div className="actions">
              {!isPublished ? <button className="btn" name="intent" value="draft">儲存草稿</button> : <button className="btn" name="intent" value="draft">轉為草稿</button>}
              {post ? <button className="btn" name="intent" value="preview" >儲存並預覽</button> : null}
            </div>
            <div className="actions">
              {isPublished ? <button className="btn btn-p" name="intent" value="update">更新</button> : <button className="btn btn-p" name="intent" value="publish">發布</button>}
              <button className="btn" name="intent" value="schedule">排程</button>
            </div>
            {post && status !== "trash" ? (
              <p style={{ marginTop: 12 }}><button className="linkbtn del" formAction={trashPostAction}>移到回收桶</button></p>
            ) : null}
          </div>
          {hasTax ? (
            <>
              <input type="hidden" name="terms_present" value="1" />
              <div className="card"><h2>{catLabel || "分類"}</h2><TermChecklist name="category_ids" terms={cats} selected={selected} /></div>
              <div className="card"><h2>{tagLabel || "標籤"}</h2><TermChecklist name="tag_ids" terms={tags} selected={selected} /></div>
            </>
          ) : null}
          <div className="card">
            <h2>{type === "product" ? "商品圖片" : "精選圖片"}</h2>
            <MediaField name="featured_media_id" initialId={post?.featured_media_id ?? null} initialUrl={featuredUrl} label={type === "product" ? "設定商品圖片" : "設定精選圖片"} />
          </div>
          {type === "page" ? (
            <div className="card">
              <h2>頁面屬性</h2>
              <label>上層頁面</label>
              <select name="parent_id" defaultValue={post?.parent_id ?? ""}>
                <option value="">（無上層）</option>
                {(parents || []).filter((p) => p.id !== post?.id).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <label>排序</label>
              <input type="number" name="menu_order" defaultValue={post?.menu_order ?? 0} />
            </div>
          ) : null}
          {type === "post" || type === "product" ? (
            <div className="card">
              <h2>討論</h2>
              <input type="hidden" name="comment_status_present" value="1" />
              <label className="inline"><input type="checkbox" name="comment_status" defaultChecked={post ? post.comment_status === "open" : type === "post"} /> {type === "product" ? "允許評價" : "允許留言"}</label>
            </div>
          ) : null}
          <p><Link href={listHref}>← 返回{typeLabel}列表</Link></p>
        </div>
      </div>
    </form>
  );
}
