"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { BUSINESSES, CALL_CONSENT_TEXT, CALLER, LEVEL_PATHS, LEVELS, PATHS, SOURCES } from "@/lib/constants";
import { MicButton } from "@/components/voice";
import { RoyalBees } from "@/components/bees";

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
  const [chat, setChat] = useState<{ role: "ai" | "me"; text: string }[]>([
    { role: "ai", text: "Hi! I'm the Hivecast assistant. Ask me anything about our apps, services or pricing, and a person can always step in." },
  ]);
  const [thinking, setThinking] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [chat, thinking]);
  const path = PATHS.find((p) => p.id === pathId);
  const formRef = useRef<HTMLFormElement>(null);
  const [fillNote, setFillNote] = useState("");
  const [fromAd, setFromAd] = useState(""); // shared ad the visitor came from (/?c=<id>)
  const [level, setLevel] = useState(0); // 1-7 when the visitor came from a community invite link
  const [video, setVideo] = useState<{ url: string | null; poster?: string | null } | null>(null);
  const [notice, setNotice] = useState(false); // AI notice pop-up, shown on the first visit
  const [callState, setCallState] = useState<"idle" | "busy" | "done">("idle");
  const [callErr, setCallErr] = useState("");

  useEffect(() => {
    try { if (!localStorage.getItem("hc-ai-notice")) setNotice(true); } catch { setNotice(true); }
  }, []);
  function closeNotice() { setNotice(false); try { localStorage.setItem("hc-ai-notice", "1"); } catch {} }

  async function requestCall(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setCallState("busy"); setCallErr("");
    try {
      await post("/api/leads", { kind: "call-request", name: f.get("name"), phone: f.get("phone"), email: f.get("email"),
        business: f.get("business"), consent: f.get("consent") === "on", website: f.get("website"), fromAd });
      setCallState("done");
    } catch (x: any) { setCallErr(x.message); setCallState("idle"); }
  }

  // Invite links look like /?level=2. They open the form with the matching path picked.
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("level"));
    const lv = LEVELS[n - 1];
    if (lv) { setLevel(n); setPathId(LEVEL_PATHS[lv[0]] || ""); setView("qual"); }
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) setFromAd(c);
  }, []);

  // The path's video, made in the dashboard with "Show on Hivecast for".
  useEffect(() => {
    if (view !== "next" || !pathId) return;
    setVideo(null);
    fetch(`/api/video/path?path=${encodeURIComponent(pathId)}`).then((r) => r.json()).then(setVideo).catch(() => setVideo({ url: null }));
  }, [view, pathId]);

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
        phone: f.get("phone"), source: f.get("source"), goal: f.get("goal"), consent: f.get("consent") === "on", website: f.get("website"), level, fromAd,
      });
      setLeadId(r.id || ""); setView("next");
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  async function notYet() {
    if (leadId) await post("/api/leads", { id: leadId }, "PATCH").catch(() => {});
    setView("later");
  }

  async function sendChat(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    const history = chat.slice(1);
    setChat((c) => [...c, { role: "me", text: t }]); setQ(""); setThinking(true);
    try { const r = await post("/api/qa", { question: t, history }); setChat((c) => [...c, { role: "ai", text: r.answer }]); }
    catch (x: any) { setChat((c) => [...c, { role: "ai", text: x.message }]); }
    finally { setThinking(false); }
  }
  function ask(e: FormEvent) { e.preventDefault(); sendChat(q); }

  return (
    <main className="wrap" style={{ paddingBlock: "24px 60px", display: "grid", gap: 16 }}>
      <div className="hive">
        <div className="hive-top">
          <img className="hive3d" src="/hive3d.svg" alt="" aria-hidden="true" />
          <RoyalBees />
          <span className="eyebrow">Hivecast · by QVTrellis <button type="button" className="ai-pill" onClick={() => setNotice(true)}>✦ This service uses AI</button></span>
          <h2>Grow what you've built, without the guesswork</h2>
          <p>Pick what you're here for. We'll show you your own short video and next step.</p>
          <div className="row">
            <button className="btn honey" type="button" onClick={() => { setView("qual"); setErr(""); }}>Get started</button>
            <button className="btn" type="button" onClick={() => { setView("keep"); setErr(""); }}>Keep me posted</button>
          </div>
          <a className="hero-link" href="/signup">Business owner? Sign up as a client →</a>
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
              {level > 0 && <div className="pill honey" style={{ justifySelf: "start" }}>Joining the community as: {LEVELS[level - 1][0]}</div>}
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
                Yes, email me. If I gave a phone number: {CALL_CONSENT_TEXT}
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
              {video?.url ? (<>
                <video className="hive-video" src={video.url} poster={video.poster || undefined} controls playsInline />
                <span className="ai-tag">Made with AI</span>
              </>) : video && <p className="note" style={{ margin: 0 }}>Your video for this path is coming soon.</p>}
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
        <div className="panel" id="chat">
          <h3>💬 Chat with us</h3>
          <p className="note" style={{ margin: 0 }}>Our AI answers right away, and a person can always step in.</p>
          <div className="chatbox" aria-live="polite">
            {chat.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
            {thinking && <div className="msg ai">…</div>}
            <div ref={chatEnd} />
          </div>
          <form className="row" onSubmit={ask}>
            <input id="qa-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a message…" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn primary" disabled={thinking}>Send</button>
          </form>
          <div style={{ marginTop: 8 }}><MicButton label="Talk instead" onText={sendChat} /></div>
        </div>
        <div className="panel" id="call">
          <h3>📞 Get a call from our AI assistant</h3>
          <p className="note" style={{ margin: 0 }}>It tells you up front that it's an AI, explains the business you pick, answers your questions and can book you a time with a person. Press 1 at any time to stop the call.</p>
          {callState === "done" ? (
            <div className="out" style={{ marginTop: 10 }}>Thanks! We saved your request and your consent. Expect a call soon from {CALLER.company}{CALLER.phone ? ` (${CALLER.phone})` : ""}. Changed your mind? <a href="/optout">Opt out here</a>.</div>
          ) : (
            <form className="form" onSubmit={requestCall} style={{ marginTop: 10 }}>
              <div className="two">
                <label>Name<input name="name" autoComplete="name" /></label>
                <label>Phone<input name="phone" type="tel" autoComplete="tel" required /></label>
              </div>
              <label>Which business is this about?<select name="business" defaultValue="Undecided">{BUSINESSES.map((b) => <option key={b}>{b}</option>)}</select></label>
              <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400 }}>
                <input type="checkbox" name="consent" required style={{ width: "auto", marginTop: 3 }} />
                <span>{CALL_CONSENT_TEXT}</span>
              </label>
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="row"><button className="btn honey" disabled={callState === "busy"}>{callState === "busy" ? "Saving…" : "Call me"}</button>{callErr && <span className="err">{callErr}</span>}</div>
            </form>
          )}
        </div>
      </div>
      <p className="note" style={{ textAlign: "center" }}>
        {CALLER.company}{CALLER.phone ? ` · ${CALLER.phone}` : ""} · <a href={`mailto:${CALLER.email}`}>{CALLER.email}</a> · <button type="button" className="linkish" onClick={() => setNotice(true)}>How we use AI</button> · <a href="/optout">Opt out of calls, texts and emails</a> · <a href="/delete">Delete my information</a> · <a href="/signup">Client sign-up</a> · <a href="/login">Team sign in</a>
      </p>
      {notice && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="ai-notice-title">
          <div className="modal panel">
            <span className="eyebrow">✦ This service uses AI</span>
            <h3 id="ai-notice-title" style={{ margin: 0 }}>How we use AI</h3>
            <ul className="note" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              <li>Our AI assistant answers questions and explains our services.</li>
              <li>With your OK first, it can call you about the business you pick and help book a time with a person.</li>
              <li>Every AI call starts by saying it's an AI. Press 1 at any time to stop it.</li>
            </ul>
            <p className="note" style={{ margin: 0 }}>Don't want AI phone calls? <a href="/optout" onClick={closeNotice}>Opt out here</a>.</p>
            <div className="row"><button className="btn honey" type="button" onClick={closeNotice} autoFocus>Got it</button><a className="btn" href="/optout" onClick={closeNotice}>Opt out of calls</a></div>
          </div>
        </div>
      )}
    </main>
  );
}
