import { getSettings, EDITABLE_SETTINGS } from "@/lib/admin/site";
import { sb } from "@/lib/admin/core";
import { settingsAction, rawSettingAction } from "../../actions";
import { MediaField } from "@/components/admin/MediaPicker";
import { Notice, type SP } from "@/components/admin/ui";

export const metadata = { title: "網站設定" };

export default async function Settings({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = await getSettings(true);
  const { data: rows } = await sb().from("settings").select("key,value,is_public,note,updated_at").order("key");
  const contact = s.contact || {};
  const tracking = s.tracking || {};
  const c = (k: string, l: string, type = "text") => <div><label>{l}</label><input type={type} name={`contact_${k}`} defaultValue={contact[k] || ""} /></div>;
  const t = (k: string, l: string, ph: string) => <div><label>{l}</label><input type="text" name={`tracking_${k}`} defaultValue={tracking[k] || ""} placeholder={ph} /></div>;
  return (
    <>
      <h1>網站設定</h1>
      <Notice sp={sp} />
      <form action={settingsAction}>
        <div className="card">
          <h2>一般</h2>
          <div className="cols">
            <div><label>網站名稱</label><input type="text" name="blogname" defaultValue={s.blogname || ""} required /></div>
            <div><label>網站標語</label><input type="text" name="blogdescription" defaultValue={s.blogdescription || ""} /></div>
          </div>
          <div className="cols" style={{ marginTop: 8 }}>
            <div><label>Logo（頁首；未設定時顯示網站名稱文字）</label><MediaField name="logo_media_id" initialId={s.site_logo?.media_id ?? null} initialUrl={s.site_logo?.url ?? null} label="設定 Logo" /></div>
            <div><label>網站圖示（favicon）</label><MediaField name="icon_media_id" initialId={s.site_icon?.media_id ?? null} initialUrl={s.site_icon?.url ?? null} label="設定網站圖示" /></div>
          </div>
        </div>
        <div className="card">
          <h2>聯絡資訊</h2>
          <div className="cols">
            {c("tel", "電話", "tel")}{c("email", "Email", "email")}{c("address", "地址")}{c("line", "LINE 官方帳號網址", "url")}
            {c("facebook", "Facebook", "url")}{c("instagram", "Instagram", "url")}{c("youtube", "YouTube", "url")}{c("messenger", "Messenger", "url")}
          </div>
        </div>
        <div className="card">
          <h2>追蹤碼</h2>
          <div className="cols">
            {t("ga", "Google Analytics 4 評估 ID", "G-XXXXXXX")}{t("gtm", "Google Tag Manager ID", "GTM-XXXXXX")}
            {t("facebook_pixel_id", "Facebook Pixel ID", "數字")}{t("facebook_domain_verification", "Facebook 網域驗證碼", "")}
          </div>
        </div>
        <div className="card">
          <h2>頂部公告列</h2>
          <label className="inline"><input type="checkbox" name="topbar_enabled" defaultChecked={!!s.topbar?.enabled} /> 顯示</label>
          <input type="text" name="topbar_text" defaultValue={s.topbar?.text || ""} placeholder="公告文字" />
        </div>
        <div className="actions"><button className="btn btn-p">儲存設定</button></div>
      </form>
      <h1 id="advanced" style={{ marginTop: 32 }}>進階：所有設定值（JSON）</h1>
      <p className="muted">直接編輯 site_palacetw.settings 的值（wp_options 對應）。修改後前台約 1 分鐘內更新。</p>
      {(rows || []).map((r: any) => (
        <form key={r.key} action={rawSettingAction} className="card">
          <input type="hidden" name="key" value={r.key} />
          <strong>{r.key}</strong> <span className="muted">{EDITABLE_SETTINGS[r.key]?.label || ""}{r.is_public ? " · 公開" : " · 僅後台"}{r.note ? ` · ${r.note}` : ""}</span>
          <textarea name="value" className="code" style={{ minHeight: 70 }} defaultValue={JSON.stringify(r.value, null, 2)} />
          <div className="actions"><button className="btn btn-s">儲存 {r.key}</button></div>
        </form>
      ))}
    </>
  );
}
