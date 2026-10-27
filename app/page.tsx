"use client";
import { FormEvent, useRef, useState } from "react";
import { BUSINESSES, PATHS, SOURCES } from "@/lib/constants";
import { MicButton } from "@/components/voice";

// Public Hivecast funnel. Visitors are not signed in; everything goes through /api/leads and /api/qa.
async function post(path: string, body: unknown, method = "POST") {
  const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json;
}

export default function Hivecast() {
  const [view, setView] = useState<"home" | "keep" | "qual" | "next" | "kept" | "later">("home");
  const [pathId, setPathId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const path = PATHS.find((p) => p.id === pathId);
  const formRef = useRef<HTMLFormElement>(null);
  const [fillNote, setFillNote] = useState("");

  // Voice fill: the visitor talks, the AI fills the form, the visitor checks it and submits.
  async function fillFromVoice(said: string) {
    setFillNote("Filling in your answers…"); setErr("");
    try {
      const r = await post("/api/fill", { said });
      if (r.pathId) setPathId(r.pathId);
      const f = formRef.current;
      if (f) for (const k of ["business", "name", "email", "phone", "source", "goal"]) {
        const el = f.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
        if (el && r[k]) el.value = r[k];
      }
      setFillNote("Done. Check everything, fix any misheard words, then tap See my next step.");
    } catch (x: any) { setFillNote(""); setErr(x.message); }
  }

  async function keepPosted(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try { await post("/api/leads", { kind: "keep-posted", email: f.get("email"), website: f.get("website") }); setView("kept"); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  async function qualify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pathId) return setErr("Pick who you are first.");
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const r = await post("/api/leads", {
        kind: "qualify", pathId, business: f.get("business"), name: f.get("name"), email: f.get("email"),
        phone: f.get("phone"), source: f.get("source"), goal: f.get("goal"), consent: f.get("consent") === "on", website: f.get("website"),
      });
      setLeadId(r.id || ""); setView("next");
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  async function notYet() {
    if (leadId) await post("/api/leads", { id: leadId }, "PATCH").catch(() => {});
    setView("later");
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return setAnswer("Type a question first.");
    setAnswer("Thinking…");
    try { const r = await post("/api/qa", { question: q }); setAnswer(r.answer); }
    catch (x: any) { setAnswer(x.message); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: "24px 60px", display: "grid", gap: 16 }}>
      <div className="hive">
        <div className="hive-top">
          <span className="eyebrow" style={{ color: "inherit", opacity: 0.7 }}>Hivecast · by QVTrellis</span>
          <h2>Grow what you've built, without the guesswork</h2>
          <p>Pick what you're here for. We'll show you your own short video and next step.</p>
          <div className="row">
            <button className="btn honey" type="button" onClick={() => { setView("qual"); setErr(""); }}>Get started</button>
            <button className="btn" type="button" onClick={() => { setView("keep"); setErr(""); }}>Keep me posted</button>
          </div>
        </div>
        <div className="hive-body">
          {view === "keep" && (
            <form className="form" onSubmit={keepPosted}>
              <h3>Keep me posted</h3>
              <p className="note" style={{ margin: 0 }}>Just your email. No calls, no pressure.</p>
              <label>Email<input id="hk-email" name="email" type="email" required /></label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="row"><button className="btn primary" disabled={busy}>Keep me posted</button>{err && <span className="err">{err}</span>}</div>
            </form>
          )}
          {view === "kept" && <div className="panel"><h3>You're on the list</h3><p className="note">Expect one useful email at a time. Unsubscribe whenever you like.</p></div>}
          {view === "qual" && (
            <form className="form" onSubmit={qualify} ref={formRef}>
              <div className="panel" style={{ display: "grid", gap: 6, background: "var(--honey-soft)", borderColor: "var(--honey)" }}>
                <b>Rather talk than type?</b>
                <span className="note">Tap the mic and say who you are, what business this is about, your name, email, and your main goal. We'll fill it all in.</span>
                <MicButton label="Talk to fill this in" onText={fillFromVoice} />
                {fillNote && <span className="note">{fillNote}</span>}
              </div>
              <h3>1. Who are you?</h3>
              <div className="paths">
                {PATHS.map((p) => (
                  <button key={p.id} type="button" className="path" aria-pressed={pathId === p.id} onClick={() => setPathId(p.id)}>
                    <b>{p.name}</b><small>{p.hint}</small>
                  </button>
                ))}
              </div>
              <h3>2. Which business is this about?</h3>
              <select id="hq-biz" name="business" defaultValue={pathId === "undecided" ? "Undecided" : BUSINESSES[0]}>
                {BUSINESSES.map((b) => <option key={b}>{b}</option>)}
              </select>
              <h3>3. Your details</h3>
              <div className="two">
                <label>Name<input id="hq-name" name="name" required /></label>
                <label>Email<input id="hq-email" name="email" type="email" required /></label>
                <label>Phone (optional)<input id="hq-phone" name="phone" type="tel" /></label>
                <label>How did you find us?<select id="hq-src" name="source">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
              </div>
              <label>Your main goal right now<input id="hq-goal" name="goal" /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400 }}>
                <input id="hq-consent" type="checkbox" name="consent" style={{ width: "auto", marginTop: 3 }} />
                It's OK to follow up by email, and by text or AI phone call if I gave a number. I can opt out any time.
              </label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="row"><button className="btn honey" disabled={busy}>See my next step</button>{err && <span className="err">{err}</span>}</div>
            </form>
          )}
          {view === "next" && path && (
            <div className="panel" style={{ display: "grid", gap: 8 }}>
              <span className="eyebrow">Your path · {path.name}</span>
              <h3 style={{ margin: 0 }}>Next: watch your short video, then pick a time</h3>
              <p className="note" style={{ margin: 0 }}>{path.hint}</p>
              <div className="row">
                <a className="btn honey" href="#book">Book a call</a>
                <button className="btn" type="button" onClick={notYet}>Not ready yet</button>
              </div>
              <p id="book" className="note">Booking calendar connects with the calendar plug-in.</p>
            </div>
          )}
          {view === "later" && <div className="panel"><h3>No problem</h3><p className="note">We'll send a few helpful notes. Come back whenever you're ready.</p></div>}
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h3>Questions?</h3>
          <p className="note">Our AI answers right away, and a person can always step in.</p>
          <form className="row" onSubmit={ask}>
            <input id="qa-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question…" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn primary">Ask</button>
          </form>
          <div style={{ marginTop: 8 }}><MicButton label="Ask out loud" onText={(t) => setQ(t)} /></div>
          {answer && <div className="out" style={{ marginTop: 10 }}>{answer}</div>}
        </div>
        <div className="panel">
          <h3>Who we help</h3>
          <div className="levels">
            {PATHS.filter((p) => p.id !== "undecided").map((p, i) => (
              <div key={p.id} className="level"><span className="lv">{i + 1}</span><div><b>{p.name}</b><div className="note">{p.hint}</div></div></div>
            ))}
          </div>
        </div>
      </div>
      <p className="note" style={{ textAlign: "center" }}><a href="/login">Team sign in</a></p>
    </main>
  );
}
