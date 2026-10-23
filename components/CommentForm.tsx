"use client";
import { useState } from "react";

/** WordPress comment form (OceanWP markup). Submissions are stored in site_palacetw.form_submissions. */
export default function CommentForm({ postId }: { postId: number }) {
  const [state, setState] = useState<{ ok?: string; errors?: string[] }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await fetch("/api/forms/comment/", { method: "POST", body: fd });
    const d = await r.json();
    setBusy(false);
    if (r.ok) { setState({ ok: d.message }); (e.target as HTMLFormElement).reset(); }
    else setState({ errors: d.errors || ["Error"] });
  };
  return (
    <div id="respond" className="comment-respond">
      <h3 id="reply-title" className="comment-reply-title">發佈留言 <small><a rel="nofollow" id="cancel-comment-reply-link" href="#respond" style={{ display: "none" }}>取消回覆</a></small></h3>
      {state.ok ? <p className="comment-awaiting-moderation woocommerce-message">{state.ok}</p> : null}
      {state.errors ? <ul className="woocommerce-error" role="alert">{state.errors.map((x) => <li key={x}>{x}</li>)}</ul> : null}
      <form action="/api/forms/comment/" method="post" id="commentform" className="comment-form" onSubmit={submit}>
        <div className="comment-textarea">
          <label htmlFor="comment" className="screen-reader-text">Comment</label>
          <textarea name="comment" id="comment" cols={39} rows={4} tabIndex={0} className="textarea-comment" placeholder="Your comment here..." />
        </div>
        <div className="comment-form-author"><label htmlFor="author" className="screen-reader-text">Enter your name or username to comment</label><input type="text" name="author" id="author" defaultValue="" placeholder="Name (required)" size={22} tabIndex={0} aria-required="true" className="input-name" /></div>
        <div className="comment-form-email"><label htmlFor="email" className="screen-reader-text">Enter your email address to comment</label><input type="text" name="email" id="email" defaultValue="" placeholder="Email (required)" size={22} tabIndex={0} aria-required="true" className="input-email" /></div>
        <div className="comment-form-url"><label htmlFor="url" className="screen-reader-text">Enter your website URL (optional)</label><input type="text" name="url" id="url" defaultValue="" placeholder="Website" size={22} tabIndex={0} className="input-website" /></div>
        <p className="comment-form-cookies-consent"><input id="wp-comment-cookies-consent" name="wp-comment-cookies-consent" type="checkbox" value="yes" /> <label htmlFor="wp-comment-cookies-consent">在<strong>瀏覽器</strong>中儲存顯示名稱、電子郵件地址及個人網站網址，以供下次發佈留言時使用。</label></p>
        <p className="form-submit">
          <input name="submit" type="submit" id="comment-submit" className="submit" value={busy ? "..." : "Post Comment"} disabled={busy} />
          <input type="hidden" name="comment_post_ID" value={postId} id="comment_post_ID" />
          <input type="hidden" name="comment_parent" id="comment_parent" value="0" />
        </p>
      </form>
    </div>
  );
}
