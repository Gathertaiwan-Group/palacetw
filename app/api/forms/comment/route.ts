import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase";
import { getIndex } from "@/lib/data";

export const dynamic = "force-dynamic";

/** WordPress comment form (wp-comments-post.php) → form_submissions (+ comments, held for moderation) */
export async function POST(req: Request) {
  const ct = req.headers.get("content-type") || "";
  const raw: Record<string, any> = ct.includes("application/json") ? await req.json().catch(() => ({})) : Object.fromEntries((await req.formData()).entries());
  const postId = Number(raw.comment_post_ID);
  const comment = String(raw.comment || "").trim();
  const author = String(raw.author || "").trim();
  const email = String(raw.email || "").trim();
  const url = String(raw.url || "").trim();
  const errors: string[] = [];
  if (!comment) errors.push("請輸入留言內容。");
  if (!author) errors.push("請輸入顯示名稱。");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("請輸入有效的電子郵件地址。");
  const ix = await getIndex();
  const post = ix.posts.find((p) => p.id === postId && p.status === "publish");
  if (!post) errors.push("找不到文章。");
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const sb = admin();
  const { data: form } = await sb.from("forms").select("id").eq("slug", "comment-form").maybeSingle();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const ua = (req.headers.get("user-agent") || "").slice(0, 500);
  const data = { comment_post_ID: postId, post_title: post!.title, comment: comment.slice(0, 5000), author: author.slice(0, 200), email: email.slice(0, 200), url: url.slice(0, 300), comment_parent: Number(raw.comment_parent) || 0, cookies_consent: raw["wp-comment-cookies-consent"] === "yes" };
  const { data: sub, error } = await sb.from("form_submissions").insert({ form_id: form?.id ?? null, data, page_url: post!.path, ip, user_agent: ua }).select("id").single();
  if (error) return NextResponse.json({ errors: [error.message] }, { status: 500 });
  const { data: c } = await sb.from("comments").insert({ post_id: postId, parent_id: data.comment_parent || null, author_name: data.author, author_url: data.url || null, content: data.comment, status: "hold", type: "comment", meta: { submission_id: sub.id } }).select("id").single();
  if (c) await sb.from("comment_private").insert({ comment_id: c.id, author_email: data.email, author_ip: ip, user_agent: ua });
  return NextResponse.json({ ok: true, id: sub.id, message: "您的留言正在等待審核。" });
}
