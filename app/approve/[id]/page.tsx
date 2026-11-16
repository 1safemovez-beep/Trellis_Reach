"use client";
import { useEffect, useState } from "react";

type Ap = { status: string; title: string; business: string | null; media_url: string | null; text: string; feedback: string | null; client_name: string | null; company: string };

// Public page: the client reads the ad and approves it, or asks for changes. Nothing posts until they approve.
export default function Approve({ params }: { params: { id: string } }) {
  const [ap, setAp] = useState<Ap | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState(false);
  const [fb, setFb] = useState("");

  useEffect(() => {
    fetch(`/api/approval?id=${encodeURIComponent(params.id)}`).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(j.error || "Approval link not found."); else setAp(j);
    }).catch(() => setErr("Couldn't load this. Please try again."));
  }, [params.id]);

  async function decide(decision: "approve" | "changes") {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/approval", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "decide", id: params.id, decision, feedback: fb }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong.");
      setAp((a) => (a ? { ...a, status: j.status, feedback: fb || a.feedback } : a));
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  if (err && !ap) return <main className="wrap" style={{ paddingBlock: 40 }}><div className="panel"><h2>This link isn't available</h2><p className="note">{err}</p></div></main>;
  if (!ap) return <main className="wrap" style={{ paddingBlock: 40 }}><p className="note">Loading…</p></main>;
  const video = ap.media_url && /\.(mp4|mov|webm)(\?|$)/i.test(ap.media_url);
  return (
    <main className="wrap" style={{ paddingBlock: "28px 60px" }}>
      <div className="panel" style={{ maxWidth: 600, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">{ap.company} · Approval{ap.business ? ` · ${ap.business}` : ""}</span>
        <h2>{ap.client_name ? `${ap.client_name}, ` : ""}please review this ad</h2>
        <p className="note" style={{ margin: 0 }}>Nothing is posted until you approve it.</p>
        <b>{ap.title}</b>
        {ap.media_url && (video ? <video className="hive-video" src={ap.media_url} controls playsInline /> : <img src={ap.media_url} alt="" style={{ width: "100%", borderRadius: 12 }} />)}
        <div className="out" style={{ whiteSpace: "pre-wrap" }}>{ap.text}</div>
        {ap.status === "Pending" ? (<>
          {changes && <label>What should we change?<textarea value={fb} onChange={(e) => setFb(e.target.value)} rows={4} /></label>}
          <div className="row">
            {!changes && <button className="btn primary" disabled={busy} onClick={() => decide("approve")}>✓ Approve this ad</button>}
            {!changes ? <button className="btn" type="button" onClick={() => setChanges(true)}>Ask for changes</button>
              : <><button className="btn honey" disabled={busy} onClick={() => decide("changes")}>Send my changes</button><button className="btn small" type="button" onClick={() => setChanges(false)}>Back</button></>}
          </div>
        </>) : (
          <div className={ap.status === "Approved" ? "pill" : "pill honey"} style={{ justifySelf: "start" }}>
            {ap.status === "Approved" ? "✓ Approved. Thank you!" : "✎ Changes sent. We'll update it and send it back to you."}
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <p className="note" style={{ margin: 0 }}>{ap.company}</p>
      </div>
    </main>
  );
}
