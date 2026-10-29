"use client";
import { FormEvent, useState } from "react";
import { CALLER } from "@/lib/constants";

// Public page where anyone who signed up can ask to have their information deleted.
export default function DeleteMyData() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/delete-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, understand: f.understand === "on" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap" style={{ paddingBlock: "40px 60px" }}>
      <div className="panel danger-zone" style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">{CALLER.company}</span>
        <h2>Delete my information</h2>
        {done ? (
          <p>Done. We've stopped all calls, texts and emails to you, and your information will be permanently deleted within 30 days. You don't need to do anything else.</p>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="warn">⚠️ This permanently deletes everything you gave us: your sign-up, contact details and history. <b>Once it's deleted, it can't be brought back.</b></p>
            <label>Email you signed up with<input name="email" type="email" autoComplete="email" /></label>
            <label>Or phone number<input name="phone" type="tel" autoComplete="tel" /></label>
            <label className="checkline"><input type="checkbox" name="understand" required /><span>I understand this can't be undone.</span></label>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="row"><button className="btn danger" disabled={busy}>{busy ? "Sending…" : "Delete my information"}</button>{err && <span className="err">{err}</span>}</div>
          </form>
        )}
        <p className="note" style={{ margin: 0 }}>Only want fewer messages? <a href="/optout">Opt out instead</a>. Team members can delete their account in the app under Settings. · <a href="/">Back to Hivecast</a></p>
      </div>
    </main>
  );
}
