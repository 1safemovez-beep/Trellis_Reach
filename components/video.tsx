"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/supabaseClient";
import { PATHS } from "@/lib/constants";

type Opt = { id: string; name: string; language?: string; gender?: string; mine?: boolean };
let cached: { avatars: Opt[]; voices: Opt[] } | null = null;

// HeyGen video maker. The avatar reads the words in the box exactly as written.
export function VideoMaker({ words, ensureSaved, auto = 0 }: { words: string; ensureSaved: () => Promise<string | null>; auto?: number }) {
  const [text, setText] = useState(words);
  const [opts, setOpts] = useState(cached);
  const [avatarId, setAvatarId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [aspect, setAspect] = useState("16:9");
  const [hivecastPath, setHivecastPath] = useState("");
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
      const r = await api("/api/video/create", { text, avatarId, voiceId, aspect, contentId, hivecastPath });
      setState("making");
      timer.current = setTimeout(() => poll(r.videoId), 8000);
    } catch (x: any) { setErr(x.message); setState("failed"); }
  }

  const busy = state === "starting" || state === "making" || state === "loading";
  return (
    <div className="panel form" style={{ marginTop: 12 }}>
      <h3 style={{ margin: 0 }}>🎬 Make the video (HeyGen)</h3>
      <label>Words the avatar says, exactly as written ({text.length}/1500)
        <textarea value={text} maxLength={1500} onChange={(e) => setText(e.target.value)} style={{ minHeight: 140 }} />
      </label>
      <div className="two">
        <label>Avatar<select value={avatarId} onChange={(e) => setAvatarId(e.target.value)} disabled={!opts}>
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
      <div className="row">
        <button className="btn honey" type="button" onClick={make} disabled={busy || !opts || !text.trim()}>
          {state === "starting" ? "Starting…" : state === "making" ? "Making video… (a few minutes)" : "Make video"}
        </button>
        {err && <span className="err">{err}</span>}
      </div>
      {state === "making" && <p className="note" style={{ margin: 0 }}>HeyGen is recording it. You can keep working; it's saved to your library and will finish there.</p>}
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
