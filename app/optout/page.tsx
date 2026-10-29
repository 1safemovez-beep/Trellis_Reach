"use client";
import { FormEvent, useState } from "react";
import { CALLER } from "@/lib/constants";

// Public opt-out page, linked from Hivecast, every email and every AI call.
export default function OptOut() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/optout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap" style={{ paddingBlock: "40px 60px" }}>
      <div className="panel" style={{ maxWidth: 520, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">{CALLER.company}</span>
        <h2>Opt out of calls, texts and emails</h2>
        {done ? (
          <p>You're opted out. You won't get any more of the messages you chose from {CALLER.company} or the businesses it markets for. It can take up to 24 hours to stop anything already scheduled.</p>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="note" style={{ margin: 0 }}>Enter the email, the phone number, or both. Nothing else is needed.</p>
            <label>Email<input name="email" type="email" autoComplete="email" /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" /></label>
            <label>Stop<select name="what" defaultValue="all">
              <option value="all">Everything (AI calls, texts and emails)</option>
              <option value="calls">AI calls and texts only</option>
              <option value="emails">Emails only</option>
            </select></label>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Saving…" : "Opt me out"}</button>{err && <span className="err">{err}</span>}</div>
          </form>
        )}
        <p className="note" style={{ margin: 0 }}>
          On any AI call from us you can also press 1 to opt out. On texts, reply STOP.
          <br />{CALLER.company}{CALLER.phone ? ` · ${CALLER.phone}` : ""} · Questions? <a href={`mailto:${CALLER.email}`}>{CALLER.email}</a> · <a href="/delete">Delete my information</a> · <a href="/">Back to Hivecast</a>
        </p>
      </div>
    </main>
  );
}
