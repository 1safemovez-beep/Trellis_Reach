"use client";
import { FormEvent, useEffect, useState } from "react";

// Public page where a person shown in an ad or video reads and signs the media release.
export default function SignRelease({ params }: { params: { id: string } }) {
  const [r, setR] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    fetch(`/api/release?id=${params.id}`).then((x) => x.json().then((j) => (x.ok ? setR(j) : setErr(j.error || "Release not found.")))).catch(() => setErr("Couldn't load."));
  }, [params.id]);
  async function sign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sign", id: params.id, signature: f.get("signature"), agree: f.get("agree") === "on" }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't sign.");
      setDone(true);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <main className="wrap" style={{ paddingBlock: "32px 60px" }}>
      <div className="panel" style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">{r?.company || "QVTrellis"} · media release</span>
        <h2>Permission to use your image</h2>
        {!r && !err && <p className="note">Loading…</p>}
        {err && !r && <p className="err">{err}</p>}
        {r && (done || r.status === "Signed") ? (
          <div className="out">✅ Signed{r.signed_at ? ` on ${new Date(r.signed_at).toLocaleDateString()}` : ""}. Thank you! You can close this page.</div>
        ) : r && (
          <form className="form" onSubmit={sign}>
            {r.media_url && (/\.(mp4|mov|webm)(\?|$)/i.test(r.media_url) ? <video className="hive-video" src={r.media_url} controls playsInline /> : <img src={r.media_url} alt="" style={{ width: "100%", borderRadius: 12 }} />)}
            <div className="out">{r.terms}</div>
            <label className="checkline"><input type="checkbox" name="agree" required /><span>I've read this and I agree.</span></label>
            <label>Type your full name to sign<input name="signature" required autoComplete="name" /></label>
            <div className="row"><button className="btn honey" disabled={busy}>{busy ? "Signing…" : "Sign"}</button>{err && <span className="err">{err}</span>}</div>
            <p className="note" style={{ margin: 0 }}>Not you, or don't agree? Just close this page and nothing will be used.</p>
          </form>
        )}
      </div>
    </main>
  );
}
