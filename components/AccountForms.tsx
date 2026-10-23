"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export function LoginRegister({ base, initialMode = "login" }: { base: string; initialMode?: "login" | "register" }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(null); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await sb().auth.signInWithPassword({ email: String(fd.get("username") || "").trim(), password: String(fd.get("password") || "") });
    setBusy(false);
    if (error) { setErr("<strong>Error:</strong> The username or password you entered is incorrect. <a href=\"" + base + "lost-password/\">Lost your password?</a>"); return; }
    router.refresh();
  };
  const register = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setErr(null); setBusy(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (password.length < 8) { setBusy(false); setErr("<strong>Error:</strong> Please enter a password of at least 8 characters."); return; }
    const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + base } });
    setBusy(false);
    if (error) { setErr("<strong>Error:</strong> " + error.message); return; }
    if (data.session) router.refresh();
    else setOk("Your account was created successfully. Please check your email to confirm your address before logging in.");
  };
  return (
    <div className="woocommerce">
      <div className="woocommerce-notices-wrapper">
        {err ? <ul className="woocommerce-error" role="alert"><li dangerouslySetInnerHTML={{ __html: err }} /></ul> : null}
        {ok ? <div className="woocommerce-message" role="alert">{ok}</div> : null}
      </div>
      <div className="oceanwp-loginform-wrap">
        {mode === "login" ? (
          // the old site had WooCommerce registration disabled on this form; registration is reachable via ?action=register
          <ul className="owp-account-links registration-disabled"><li className="login"><span className="owp-account-link current">Login</span></li></ul>
        ) : (
          <ul className="owp-account-links">
            <li className="login"><a href="#" className="owp-account-link" onClick={(e) => { e.preventDefault(); setMode("login"); setErr(null); }}>Login</a></li>
            <li className="or">Or</li>
            <li className="register"><span className="owp-account-link current">Register</span></li>
          </ul>
        )}
        {mode === "login" ? (
          <>
            <h2>Login</h2>
            <form className="woocommerce-form woocommerce-form-login login" method="post" onSubmit={login}>
              <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
                <label htmlFor="username">Username or email address&nbsp;<span className="required">*</span></label>
                <input type="text" className="woocommerce-Input woocommerce-Input--text input-text" name="username" id="username" autoComplete="username" defaultValue="" required />
              </p>
              <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
                <label htmlFor="password">Password&nbsp;<span className="required">*</span></label>
                <input className="woocommerce-Input woocommerce-Input--text input-text" type="password" name="password" id="password" autoComplete="current-password" required />
              </p>
              <p className="form-row">
                <label className="woocommerce-form__label woocommerce-form__label-for-checkbox woocommerce-form-login__rememberme">
                  <input className="woocommerce-form__input woocommerce-form__input-checkbox" name="rememberme" type="checkbox" id="rememberme" value="forever" /> <span>Remember me</span>
                </label>
                <button type="submit" className="woocommerce-button button woocommerce-form-login__submit" name="login" value="Log in" disabled={busy}>Log in</button>
              </p>
              <p className="woocommerce-LostPassword lost_password"><Link href={`${base}lost-password/`}>Lost your password?</Link></p>
              <p className="pt-register-link" style={{ textAlign: "center", fontSize: 13 }}><a href="#" onClick={(e) => { e.preventDefault(); setMode("register"); setErr(null); }}>還沒有帳號？註冊</a></p>
            </form>
          </>
        ) : (
          <>
            <h2>Register</h2>
            <form method="post" className="woocommerce-form woocommerce-form-register register" onSubmit={register}>
              <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
                <label htmlFor="reg_email">Email address&nbsp;<span className="required">*</span></label>
                <input type="email" className="woocommerce-Input woocommerce-Input--text input-text" name="email" id="reg_email" autoComplete="email" defaultValue="" required />
              </p>
              <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide">
                <label htmlFor="reg_password">Password&nbsp;<span className="required">*</span></label>
                <input type="password" className="woocommerce-Input woocommerce-Input--text input-text" name="password" id="reg_password" autoComplete="new-password" required />
              </p>
              <div className="woocommerce-privacy-policy-text"><p>Your personal data will be used to support your experience throughout this website, to manage access to your account, and for other purposes described in our privacy policy.</p></div>
              <p className="woocommerce-form-row form-row"><button type="submit" className="woocommerce-Button woocommerce-button button woocommerce-form-register__submit" name="register" value="Register" disabled={busy}>Register</button></p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export function LostPassword() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("user_login") || "").trim();
    if (!email) { setErr("Enter a username or email address."); return; }
    const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + "/my-account-2/edit-account/" });
    if (error) setErr(error.message); else setDone(true);
  };
  if (done) return <div className="woocommerce"><div className="woocommerce-message" role="alert">Password reset email has been sent.</div><p>A password reset email has been sent to the email address on file for your account, but may take several minutes to show up in your inbox.</p></div>;
  return (
    <div className="woocommerce">
      <div className="woocommerce-notices-wrapper">{err ? <ul className="woocommerce-error" role="alert"><li>{err}</li></ul> : null}</div>
      <form method="post" className="woocommerce-ResetPassword lost_reset_password" onSubmit={submit}>
        <p>Lost your password? Please enter your username or email address. You will receive a link to create a new password via email.</p>
        <p className="woocommerce-form-row woocommerce-form-row--first form-row form-row-first">
          <label htmlFor="user_login">Username or email&nbsp;<span className="required">*</span></label>
          <input className="woocommerce-Input woocommerce-Input--text input-text" type="text" name="user_login" id="user_login" autoComplete="username" />
        </p>
        <div className="clear" />
        <p className="woocommerce-form-row form-row"><button type="submit" className="woocommerce-Button button" value="Reset password">Reset password</button></p>
      </form>
    </div>
  );
}

export function LogoutLink({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return <a href="#" className={className} onClick={async (e) => { e.preventDefault(); await sb().auth.signOut(); router.refresh(); }}>{children}</a>;
}

export function EditAccount({ email }: { email: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("password_1") || ""), p2 = String(fd.get("password_2") || "");
    if (!p1) { setMsg("Account details changed successfully."); return; }
    if (p1 !== p2) { setMsg("New passwords do not match."); return; }
    const { error } = await sb().auth.updateUser({ password: p1 });
    setMsg(error ? error.message : "Account details changed successfully.");
  };
  return (
    <form className="woocommerce-EditAccountForm edit-account" onSubmit={submit}>
      {msg ? <div className="woocommerce-message" role="alert">{msg}</div> : null}
      <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label htmlFor="account_email">Email address&nbsp;<span className="required">*</span></label><input type="email" className="woocommerce-Input woocommerce-Input--email input-text" name="account_email" id="account_email" defaultValue={email} readOnly /></p>
      <fieldset><legend>Password change</legend>
        <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label htmlFor="password_1">New password (leave blank to leave unchanged)</label><input type="password" className="woocommerce-Input woocommerce-Input--password input-text" name="password_1" id="password_1" autoComplete="off" /></p>
        <p className="woocommerce-form-row woocommerce-form-row--wide form-row form-row-wide"><label htmlFor="password_2">Confirm new password</label><input type="password" className="woocommerce-Input woocommerce-Input--password input-text" name="password_2" id="password_2" autoComplete="off" /></p>
      </fieldset>
      <p><button type="submit" className="woocommerce-Button button" name="save_account_details" value="Save changes">Save changes</button></p>
    </form>
  );
}
