"use client";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Passwordless sign-in: the team member gets a one-time link by email.
export default function Login() {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const email = String(new FormData(e.currentTarget).get("email") || "").trim().toLowerCase();
    const { error } = await supabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/app`, shouldCreateUser: true },
    });
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <main className="wrap">
      <div className="login panel">
        <div className="brand"><div className="logo">TR</div><div><h1>Trellis Reach</h1><small>Team sign in</small></div></div>
        {sent ? (
          <p>Check your email for a sign-in link. You can close this tab.</p>
        ) : (
          <form className="form" onSubmit={submit}>
            <label>Email<input id="login-email" name="email" type="email" required autoComplete="email" /></label>
            <button className="btn primary">Email me a sign-in link</button>
            {err && <p className="err">{err}</p>}
            <p className="note">Only people on the team list can open the dashboard.</p>
          </form>
        )}
      </div>
    </main>
  );
}
