"use client";
import { useEffect, useRef, useState } from "react";
import { api, supabase } from "@/lib/supabaseClient";
import { PATHS } from "@/lib/constants";

type Opt = { id: string; name: string; language?: string; gender?: string; mine?: boolean };
let cached: { avatars: Opt[]; voices: Opt[] } | null = null;

// HeyGen video maker. The avatar reads the words in the box exactly as written.
export function VideoMaker({ words, ensureSaved, auto = 0, photoFile = null }: { words: string; ensureSaved: () => Promise<string | null>; auto?: number; photoFile?: File | null }) {
  const [text, setText] = useState(words);
  const [opts, setOpts] = useState(cached);
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [hivecastPath, setHivecastPath] = useState("");
  const [photoId, setPhotoId] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoOk, setPhotoOk] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  // A photo added under the squares (already permission-checked there) is used automatically.
  useEffect(() => { if (photoFile && /^image\/(jpeg|png)$/.test(photoFile.type) && !photoId) { setPhotoOk(true); usePhoto(photoFile, true); } }, [photoFile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function usePhoto(f: File | null, ok = photoOk) {
    if (!f) return;
    if (!ok) { setErr("Tick the box first: it's you, or you have their written permission."); return; }
    setErr(""); setPhotoBusy(true); setPhotoPreview(URL.createObjectURL(f));
    try {
      const { data } = await supabase().auth.getSession();
      const fd = new FormData(); fd.append("photo", f); fd.append("consent", "yes");
      const res = await fetch("/api/video/photo", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token || ""}` }, body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't use that photo.");
      setPhotoId(j.photoId);
    } catch (x: any) { setErr(x.message); setPhotoPreview(""); } finally { setPhotoBusy(false); }
  }
  const [state, setState] = useState<"idle" | "loading" | "starting" | "making" | "done" | "failed">("idle");
  const [err, setErr] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setText(words), [words]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (opts) { setAvatarId((a) => a || opts.avatars[0]?.id || ""); setVoiceId((v) => v || opts.voices[0]?.id || ""); return; }
    setState("loading");
    api("/api/video/options", {})
      .then((r) => { cached = r; setOpts(r); setState("idle"); })
      .catch((x) => { setErr(x.message); setState("idle"); });
  }, [opts]);

  // "All AI": start the video by itself once the avatar and voice lists are ready.
  const started = useRef(0);
  useEffect(() => {
    if (auto && started.current !== auto && opts && avatarId && voiceId && text.trim()) { started.current = auto; make(); }
  }, [auto, opts, avatarId, voiceId, text]); // eslint-disable-line react-hooks/exhaustive-deps

  async function poll(videoId: string) {
    try {
      const s = await api("/api/video/status", { videoId });
      if (s.status === "completed") { setUrl(s.url); setState("done"); return; }
      if (s.status === "failed") { setErr(s.error || "HeyGen couldn't make this video."); setState("failed"); return; }
      timer.current = setTimeout(() => poll(videoId), 8000);
    } catch (x: any) { setErr(x.message); setState("failed"); }
  }

  async function make() {
    setErr(""); setUrl(null); setState("starting");
    try {
      const contentId = await ensureSaved();
      const r = await api("/api/video/create", { text, avatarId, photoId, voiceId, aspect, contentId, hivecastPath });
      setState("making");
      timer.current = setTimeout(() => poll(r.videoId), 8000);
    } catch (x: any) { setErr(x.message); setState("failed"); }
  }

  const busy = state === "starting" || state === "making" || state === "loading";
  return (
    <div className="panel form" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>🎬 Make the video</h3>
      {err && /isn't set up|key is wrong|401/i.test(err) && (
        <div className="warn">Video isn't connected yet. In Vercel → Settings → Environment Variables, add <b>HEYGEN_API_KEY</b> with your HeyGen API key, then Redeploy.</div>
      )}
      <div className="row">
        <button className="btn honey" type="button" onClick={make} disabled={busy || !opts || !text.trim()} style={{ fontSize: 17, padding: "14px 22px" }}>
          {state === "loading" ? "Getting ready…" : state === "starting" ? "Starting…" : state === "making" ? "🎬 Making your video…" : "🎬 Make the video"}
        </button>
      </div>
      <div className="photo-pick">
        {photoPreview ? <img src={photoPreview} alt="Your photo" /> : <span className="photo-ph" aria-hidden="true">🤳</span>}
        <div className="form" style={{ gap: 6 }}>
          <b>{photoId ? "✅ Your face will be in the video" : "Put your own face in the video (optional)"}</b>
          <label className="checkline"><input type="checkbox" checked={photoOk} onChange={(e) => setPhotoOk(e.target.checked)} /><span>This is me, or I have their written permission.</span></label>
          <label className="btn small" style={{ justifySelf: "start", cursor: "pointer" }}>
            {photoBusy ? "Uploading…" : photoId ? "Change photo" : "📷 Add a photo"}
            <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => usePhoto(e.target.files?.[0] || null)} />
          </label>
          {photoId && <button className="btn small" type="button" onClick={() => { setPhotoId(""); setPhotoPreview(""); }} style={{ justifySelf: "start" }}>Use an AI presenter instead</button>}
          <span className="note">Clear, front-facing photo, one face, JPG or PNG.</span>
        </div>
      </div>
      <details>
        <summary className="note" style={{ cursor: "pointer" }}>Change the words, presenter or voice</summary>
        <div className="form" style={{ marginTop: 8 }}>
      <label>Words the avatar says ({text.length}/1500)
        <textarea value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} style={{ minHeight: 120 }} />
      </label>
      <div className="two">
        <label>AI presenter{photoId ? " (not used: your photo is)" : ""}<select value={avatarId} onChange={(e) => setAvatarId(e.target.value)} disabled={!opts}>
          {opts?.avatars.map((a) => <option key={a.id} value={a.id}>{a.name}{a.gender ? ` · ${a.gender}` : ""}</option>) || <option>Loading…</option>}
        </select></label>
        <label>Voice<select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} disabled={!opts}>
          {opts?.voices.map((v) => <option key={v.id} value={v.id}>{v.mine ? "★ " : ""}{v.name}{v.language ? ` · ${v.language}` : ""}</option>) || <option>Loading…</option>}
        </select></label>
        <label>Shape<select value={aspect} onChange={(e) => setAspect(e.target.value)}>
          <option value="16:9">Wide 16:9 (website, YouTube)</option><option value="9:16">Tall 9:16 (Reels, TikTok)</option>
        </select></label>
        <label>Show on Hivecast for<select value={hivecastPath} onChange={(e) => setHivecastPath(e.target.value)}>
          <option value="">Don't show on Hivecast</option>{PATHS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      </div>
        </div>
      </details>
      {err && <span className="err">{err}</span>}
      {state === "making" && <p className="note" style={{ margin: 0 }}>Takes a few minutes. You can keep working: it lands in your Library and plays there when ready.</p>}
      {url && (<>
        <p className="note" style={{ margin: 0 }}>✅ Your video is ready and saved to the library.</p>
        <video className="hive-video" src={url} controls playsInline autoPlay />
        <div className="row"><a className="btn small" href={url} target="_blank" rel="noreferrer">Download</a><span className="ai-tag">Made with AI</span></div>
      </>)}
    </div>
  );
}

// Shows a saved video in the library. It loads by itself, keeps checking while HeyGen is
// still making it, and asks for a fresh link each time because HeyGen links expire.
export function PlaySaved({ videoId, status }: { videoId: string; status?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const s = await api("/api/video/status", { videoId });
        if (!alive) return;
        if (s.status === "completed") { setUrl(s.url); setMsg(""); return; }
        if (s.status === "failed") { setMsg(s.error || "This video failed."); return; }
        setMsg("🎬 Video is being made… it shows here when ready.");
        timer.current = setTimeout(load, 15000);
      } catch (x: any) { if (alive) setMsg(x.message); }
    }
    if (status === "failed") setMsg("This video failed. Make it again from Create.");
    else load();
    return () => { alive = false; clearTimeout(timer.current); };
  }, [videoId, status]);
  if (url) return (<>
    <video className="hive-video" src={url} controls playsInline />
    <span className="ai-tag">Made with AI</span>
  </>);
  return msg ? <p className="note" style={{ margin: "4px 0 0" }}>{msg}</p> : null;
}
