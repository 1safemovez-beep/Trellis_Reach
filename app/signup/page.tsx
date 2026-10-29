"use client";
import { FormEvent, useState } from "react";
import { CALL_CONSENT_TEXT, CALLER, CLIENT_CONSENT_PROMISE, CLIENT_SERVICES, READINESS_AUTH_TEXT, SOURCES } from "@/lib/constants";

// Client sign-up: a business owner picks the services they want, including AI calls and booking.
export default function ClientSignup() {
  const [services, setServices] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const wantsCalls = services.some((s) => /AI phone|booking/i.test(s));
  const wantsReadiness = services.some((s) => /readiness/i.test(s));
  const toggle = (s: string) => setServices((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/leads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "client-signup", company: f.get("company"), name: f.get("name"), email: f.get("email"), phone: f.get("phone"),
          site: f.get("site"), industry: f.get("industry"), goal: f.get("goal"), source: f.get("source"), services,
          agree: f.get("agree") === "on", readinessAuth: f.get("readinessAuth") === "on", customerConsent: f.get("customerConsent") === "on", consent: f.get("consent") === "on", website: f.get("website"),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: "32px 60px" }}>
      <div className="panel" style={{ maxWidth: 620, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">Trellis Reach · client sign-up <span className="pill honey">✦ This service uses AI</span></span>
        <h2>Let AI answer, follow up and book for your business</h2>
        <p className="note" style={{ margin: 0 }}>Pick what you want. Our AI answers questions, follows up and books appointments, then hands every serious lead to a person.</p>
        {done ? (
          <div className="out">You're signed up. We'll email you within one business day to set things up. Questions? Use the chat on <a href="/">Hivecast</a>.</div>
        ) : (
          <form className="form" onSubmit={submit}>
            <div className="two">
              <label>Business name<input name="company" required /></label>
              <label>Your name<input name="name" required autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              <label>Phone<input name="phone" type="tel" autoComplete="tel" /></label>
              <label>Website (optional)<input name="site" /></label>
              <label>Industry<input name="industry" placeholder="e.g. roofing, med spa, real estate" /></label>
            </div>
            <label>What do you want more of?<input name="goal" placeholder="e.g. more booked estimates" /></label>
            <label>How did you find us?<select name="source">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <h3 style={{ margin: "6px 0 0" }}>Services</h3>
            <div className="checks">
              {CLIENT_SERVICES.map((s) => <label key={s}><input type="checkbox" checked={services.includes(s)} onChange={() => toggle(s)} />{s}</label>)}
            </div>
            <div className="checks">
              {wantsReadiness && <label><input type="checkbox" name="readinessAuth" required /><span><b>Required for the readiness check:</b> {READINESS_AUTH_TEXT}</span></label>}
              {wantsCalls && <label><input type="checkbox" name="customerConsent" required /><span><b>Required for AI calls:</b> {CLIENT_CONSENT_PROMISE}</span></label>}
              <label><input type="checkbox" name="agree" required /><span>I agree that {CALLER.company} sets this up with AI, that every AI call says it's an AI and offers "press 1 to opt out", and that a person handles anything the AI can't.</span></label>
              <label><input type="checkbox" name="consent" /><span>Optional, for me: {CALL_CONSENT_TEXT}</span></label>
            </div>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="row"><button className="btn honey" disabled={busy}>{busy ? "Signing up…" : "Sign up"}</button>{err && <span className="err">{err}</span>}</div>
          </form>
        )}
        <p className="note" style={{ margin: 0 }}>{CALLER.company}{CALLER.phone ? ` · ${CALLER.phone}` : ""} · <a href="/optout">Opt out</a> · <a href="/">Back to Hivecast</a></p>
      </div>
    </main>
  );
}
