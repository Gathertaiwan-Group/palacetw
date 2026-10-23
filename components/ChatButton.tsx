import { getIndex, setting } from "@/lib/data";

/** The old site used the Facebook Customer Chat plugin (discontinued by Meta in 2024-05);
 *  replaced by a Messenger link bubble at the same position (bottom-right). */
export default async function ChatButton() {
  const ix = await getIndex();
  const chat = setting<{ url?: string }>(ix, "chat_widget", {});
  if (!chat.url) return null;
  return (
    <a href={chat.url} target="_blank" rel="noopener" aria-label="Facebook Messenger" className="fb-customerchat pt-chat-bubble"
      style={{ position: "fixed", right: 18, bottom: 70, width: 50, height: 50, borderRadius: "50%", background: "#0A7CFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,.15)", zIndex: 9998 }}>
      <svg width="26" height="26" viewBox="0 0 36 36" fill="#fff" aria-hidden="true"><path d="M18 2.1C9.1 2.1 2 8.6 2 16.8c0 4.6 2.3 8.7 5.9 11.4V34l5.4-3c1.5.4 3 .6 4.7.6 8.9 0 16-6.5 16-14.7S26.9 2.1 18 2.1zm1.6 19.8-4.1-4.4-8 4.4 8.8-9.3 4.2 4.4 7.9-4.4-8.8 9.3z" /></svg>
    </a>
  );
}
