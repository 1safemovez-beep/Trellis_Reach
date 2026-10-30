"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PasswordInput } from "@/components/password";

// Team sign-in. Two ways in:
//  1. Email code: Supabase emails a link and a 6-digit code (type the code here).
//  2. Password: for accounts created in Supabase → Authentication → Users → Add user.
export default function Login() {
  const [mode, setMode] = useState<"code" | "password" | "newpass">("code");
  const [step, setStep] = useState<"email" | "verify">("email");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Coming back from a "reset password" email: let them choose a new password.
  useEffect(() => {
    const { data } = supabase().auth.onAuthStateChange((event: string) => { if (event === "PASSWORD_RECOVERY") { setMode("newpass"); setMsg("Choose your new password."); } });
    if (window.location.hash.includes("type=recovery")) setMode("newpass");
    return () => data.subscription.unsubscribe();
  }, []);

  async function forgot() {
    if (!email.trim()) return setErr("Type your email above first.");
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { error } = await supabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/login` });
      if (error) throw error;
      setMsg("Sent. Check your inbox and spam folder for the reset link, then choose a new password.");
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  }

  async function setNewPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p1 = String(f.get("p1") || ""), p2 = String(f.get("p2") || "");
    if (p1.length < 8) return setErr("Use at least 8 characters.");
    if (p1 !== p2) return setErr("The two passwords don't match.");
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase().auth.updateUser({ password: p1 });
      if (error) throw error;
      window.location.href = "/app";
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  }

  function explain(e: any): string {
    const m = String(e?.message || e || "");
    if (/not authorized/i.test(m)) return "Supabase's built-in email only sends to the email you use for your Supabase account. Use that email, or sign in with a password instead.";
    if (/rate limit|too many/i.test(m)) return "Too many emails sent in the last hour. Wait a bit, or sign in with a password instead.";
    if (/not configured|isn't configured/i.test(m)) return "The site's Supabase keys aren't set. Check /api/health.";
    if (/invalid login|invalid credentials/i.test(m)) return "Email or password is wrong.";
    if (/email not confirmed/i.test(m)) return "This account isn't confirmed yet. In Supabase, open the user and confirm them, or tick Auto Confirm when adding.";
    if (/token has expired|invalid/i.test(m)) return "That code didn't work or has expired. Send a new one.";
    return m || "Something went wrong. Try again.";
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/app`, shouldCreateUser: true },
      });
      if (error) throw error;
      setStep("verify");
      setMsg("Sent. Check your inbox and spam folder. Tap the link, or type the 6-digit code below.");
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get("code") || "").replace(/\s/g, "");
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase().auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" });
      if (error) throw error;
      window.location.href = "/app";
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  }

  async function withPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") || "");
    setErr(""); setBusy(true);
    try {
      const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      window.location.href = "/app";
    } catch (x) { setErr(explain(x)); } finally { setBusy(false); }
  }

  return (
    <main className="wrap">
      <div className="login panel">
        <div className="brand"><div className="logo">TR</div><div><h1>Trellis Reach</h1><small>Team sign in</small></div></div>
        <div className="row">
          <button type="button" className={"btn small" + (mode === "code" ? " primary" : "")} onClick={() => { setMode("code"); setErr(""); }}>Email code</button>
          <button type="button" className={"btn small" + (mode === "password" ? " primary" : "")} onClick={() => { setMode("password"); setErr(""); }}>Password</button>
        </div>
        {mode !== "newpass" && <label>Email<input id="login-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
        {mode === "newpass" && (
          <form className="form" onSubmit={setNewPassword}>
            <label>New password<PasswordInput name="p1" autoComplete="new-password" minLength={8} /></label>
            <label>Type it again<PasswordInput name="p2" autoComplete="new-password" minLength={8} /></label>
            <button className="btn primary" disabled={busy}>Save password and sign in</button>
          </form>
        )}

        {mode === "code" && step === "email" && (
          <form className="form" onSubmit={sendCode}>
            <button className="btn primary" disabled={busy || !email}>{busy ? "Sending…" : "Email me a sign-in code"}</button>
          </form>
        )}
        {mode === "code" && step === "verify" && (
          <form className="form" onSubmit={verify}>
            <label>6-digit code<input id="login-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} required /></label>
            <div className="row">
              <button className="btn primary" disabled={busy}>Sign in</button>
              <button type="button" className="btn small" onClick={() => { setStep("email"); setMsg(""); }}>Send a new code</button>
            </div>
          </form>
        )}
        {mode === "password" && (
          <form className="form" onSubmit={withPassword}>
            <label>Password<PasswordInput id="login-pass" name="password" autoComplete="current-password" /></label>
            <button className="btn primary" disabled={busy || !email}>Sign in</button>
            <button type="button" className="btn small" onClick={forgot} disabled={busy}>Forgot password?</button>
          </form>
        )}

        {msg && <p className="note">{msg}</p>}
        {err && <p className="err">{err}</p>}
        <p className="note">The dashboard opens for emails on the team list. Owners add people in Supabase.</p>
      </div>
    </main>
  );
}
