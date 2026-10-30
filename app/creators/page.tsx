"use client";
import { FormEvent, useEffect, useState } from "react";
import { AdPreview } from "@/components/ad";
import { CALL_CONSENT_TEXT, CALLER } from "@/lib/constants";
import { RoyalBees } from "@/components/bees";
import { MicButton } from "@/components/voice";

const MAKES = ["Video ads / UGC", "AI videos", "Photo or graphic ads", "Writing / scripts", "Social posting", "Voice-over"];

// Public creator page: try a free sample, then join as a creator, tester and Seed Loop founding member.
export default function Creators() {
  const [what, setWhat] = useState("");
  const [sample, setSample] = useState<any>(null);
  const [trying, setTrying] = useState(false);
  const [tryErr, setTryErr] = useState("");
  const [makes, setMakes] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleOk, setSampleOk] = useState(false);
  async function uploadSample(f: File | null) {
    if (!f) return;
    if (!sampleOk) { setErr("Tick the box first: it's your own work."); return; }
    setSampleBusy(true); setErr("");
    try {
      const fd = new FormData(); fd.append("file", f); fd.append("ok", "yes");
      const res = await fetch("/api/public-upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Upload failed.");
      setSampleUrl(j.url);
    } catch (x: any) { setErr(x.message); } finally { setSampleBusy(false); }
  }
  const [examples, setExamples] = useState<any[]>([]);
  useEffect(() => { fetch("/api/examples").then((r) => r.json()).then((j) => setExamples(j.examples || [])).catch(() => {}); }, []);

  async function tryIt(e: FormEvent) {
    e.preventDefault(); setTrying(true); setTryErr(""); setSample(null);
    try {
      const res = await fetch("/api/try-ad", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ what }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't make a sample.");
      setSample(j);
    } catch (x: any) { setTryErr(x.message); } finally { setTrying(false); }
  }
  async function join(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        kind: "creator-signup", name: f.get("name"), email: f.get("email"), phone: f.get("phone"), links: f.get("links"), makes,
        tester: f.get("tester") === "on", sampleUrl, inSample: f.get("inSample") === "on", seedLoop: f.get("seedLoop") === "on", agree: f.get("agree") === "on",
        consent: f.get("consent") === "on", website: f.get("website"),
      }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Something went wrong. Please try again.");
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <main className="wrap" style={{ paddingBlock: "24px 60px", display: "grid", gap: 16 }}>
      <div className="hive">
        <div className="hive-top">
          <img className="hive3d" src="/hive3d.svg" alt="" aria-hidden="true" />
          <RoyalBees />
          <span className="eyebrow">Trellis Reach · for creators <span className="ai-pill">✦ This service uses AI</span></span>
          <h2>Make ads. Get paid. Grow with the hive.</h2>
          <p>Create videos and ads for real businesses with our AI tools, enter the monthly Hive Challenge for cash or credits, and help test new apps.</p>
          <a className="hero-link" href="#join">Join as a creator →</a>
        </div>
      </div>

      <div className="grid2">
        <form className="panel form" onSubmit={tryIt}>
          <h3 style={{ margin: 0 }}>✨ Try it free</h3>
          <p className="note" style={{ margin: 0 }}>Tell the AI what to advertise and see a sample ad in seconds. No sign-up needed.</p>
          <label>What's the ad for?<input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. a mobile car detailing business in Atlanta" /></label>
          <MicButton label="Say it" onText={(t) => setWhat(t)} />
          <div className="row"><button className="btn honey" disabled={trying}>{trying ? "Making it…" : "Make my sample ad"}</button>{tryErr && <span className="err">{tryErr}</span>}</div>
          {sample && (
            <div className="out" style={{ display: "grid", gap: 6 }}>
              <b>{sample.hook}</b><span>{sample.ad}</span><b>👉 {sample.cta}</b>
              <span className="note">🎬 Video idea: {sample.videoIdea}</span>
              <span className="ai-tag">Made with AI · members also get AI video, captions, sharing and the Hive Challenge</span>
            </div>
          )}
        </form>

        <div className="panel" style={{ display: "grid", gap: 8 }}>
          <h3 style={{ margin: 0 }}>What you get</h3>
          <div className="levels">
            <div className="level"><span className="lv">🎬</span><div><b>Make ads and videos</b><div className="note">AI tools for scripts, AI video and captions, or bring your own work.</div></div></div>
            <div className="level"><span className="lv">🏆</span><div><b>Monthly Hive Challenge</b><div className="note">Compete to make a client's winning ad. Winners earn cash or credits, and both on big campaigns.</div></div></div>
            <div className="level"><span className="lv">🧪</span><div><b>Be a tester</b><div className="note">Try new apps early, give feedback, and earn points.</div></div></div>
            <div className="level"><span className="lv">🌱</span><div><b>Seed Loop (coming soon)</b><div className="note">Our program to learn, earn and get your own app built. Founding members get in first.</div></div></div>
          </div>
        </div>
      </div>

      {examples.length > 0 && (
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <h3 style={{ margin: 0 }}>⭐ Made with Trellis Reach</h3>
          <div className="lib">{examples.map((x) => (
            <div key={x.id} className="lib-card">
              {x.video ? <><video className="hive-video" src={x.video} controls playsInline /><div className="lib-body"><b>{x.title}</b><span className="ai-tag">Made with AI</span></div></>
                : x.image ? <img src={x.image} alt={x.title} style={{ width: "100%", display: "block" }} /> : <AdPreview business={x.business || "Trellis Reach"} title={x.title} text={x.text} />}
            </div>
          ))}</div>
        </div>
      )}

      <div className="panel" id="join" style={{ maxWidth: 640, width: "100%", margin: "0 auto", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Join as a creator</h2>
        {done ? (
          <div className="out">You're in the hive! 🐝 We'll email you soon with your next steps{" "}— creator access, your first challenge and testing invites.</div>
        ) : (
          <form className="form" onSubmit={join}>
            <div className="two">
              <label>Name<input name="name" required autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              <label>Phone (optional)<input name="phone" type="tel" autoComplete="tel" /></label>
              <label>Your work or socials (optional)<input name="links" placeholder="Instagram, TikTok, portfolio…" /></label>
            </div>
            <div className="drop" style={{ gridTemplateColumns: "1fr" }}>
              <b>Show us your work (optional)</b>
              <label className="checkline"><input type="checkbox" checked={sampleOk} onChange={(e) => setSampleOk(e.target.checked)} /><span>This is my own work, and anyone shown agreed to be in it.</span></label>
              <label className="btn honey small" style={{ cursor: "pointer", justifySelf: "start" }}>{sampleBusy ? "Uploading…" : sampleUrl ? "✅ Uploaded · change" : "⬆ Upload a sample"}
                <input type="file" accept="image/*,video/*" hidden onChange={(e) => { uploadSample(e.target.files?.[0] || null); e.target.value = ""; }} />
              </label>
              {sampleUrl && <label className="checkline"><input type="checkbox" name="inSample" /><span>I'm shown in it, and QVTrellis may use it to promote the creator program.</span></label>}
            </div>
            <h3 style={{ margin: "4px 0 0" }}>What do you make?</h3>
            <div className="checks">{MAKES.map((m) => <label key={m}><input type="checkbox" checked={makes.includes(m)} onChange={() => setMakes((v) => (v.includes(m) ? v.filter((x) => x !== m) : [...v, m]))} />{m}</label>)}</div>
            <div className="checks">
              <label><input type="checkbox" name="tester" defaultChecked /><span><b>Yes, I want to be a tester</b> and try new apps early.</span></label>
              <label><input type="checkbox" name="seedLoop" defaultChecked /><span><b>Save me a founding spot in Seed Loop</b> when it opens.</span></label>
              <label><input type="checkbox" name="agree" required /><span>I'll only submit my own work, I'll get permission from anyone shown in my videos, and I agree the business can use an entry that wins.</span></label>
              <label><input type="checkbox" name="consent" /><span>Optional: {CALL_CONSENT_TEXT}</span></label>
            </div>
            <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <div className="row"><button className="btn honey" disabled={busy}>{busy ? "Joining…" : "Join the hive"}</button>{err && <span className="err">{err}</span>}</div>
          </form>
        )}
      </div>
      <p className="note" style={{ textAlign: "center" }}>{CALLER.company} · <a href={`mailto:${CALLER.email}`}>{CALLER.email}</a> · <a href="/">Hivecast</a> · <a href="/signup">Client sign-up</a> · <a href="/optout">Opt out</a> · <a href="/delete">Delete my information</a></p>
    </main>
  );
}
