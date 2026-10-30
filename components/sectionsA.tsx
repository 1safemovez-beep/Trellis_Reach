"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { MicButton, speak, speechSupported, stopSpeaking, useListen } from "./voice";
import { api, supabase } from "@/lib/supabaseClient";
import { BUSINESSES, CONTENT_FORMATS, MAKE_KINDS, PROFILE_SLOTS, SOURCES } from "@/lib/constants";
import { AdImage } from "./adimage";
import type { TeamData } from "@/lib/useTeamData";
import { Bars, copyText, Empty, Head, money, useToast, when } from "./ui";
import { PlaySaved, VideoMaker } from "./video";

export function calItems(d: TeamData) {
  return [
    ...d.bookings.map((b) => ({ t: b.starts_at, title: b.title, kind: b.kind, who: b.who || "", ex: b.example })),
    ...d.content.filter((c) => c.scheduled_for).map((c) => ({ t: c.scheduled_for!, title: c.title, kind: "Content goes live", who: c.business, ex: c.example })),
  ].sort((a, b) => +new Date(a.t) - +new Date(b.t));
}

export function CalRow({ i }: { i: ReturnType<typeof calItems>[number] }) {
  return (
    <div className="calrow">
      <span className="d">{when(i.t)}</span>
      <div><b>{i.title}</b>{i.ex && <> <span className="pill muted">Example</span></>}<div className="note">{i.who}</div></div>
      <span className={"pill" + (i.kind === "Booking call" ? " honey" : "")}>{i.kind}</span>
    </div>
  );
}

export function stats(d: TeamData) {
  const st: Record<string, number> = {};
  for (const s of ["New", "Nurture", "Booked", "Won", "Lost"]) st[s] = d.leads.filter((l) => l.stage === s).length;
  const rev = d.leads.filter((l) => l.stage === "Won").reduce((a, l) => a + (+l.value || 0), 0);
  return { st, rev, total: d.leads.length };
}

export function Board({ d, go }: { d: TeamData; go: (t: string) => void }) {
  const { st, rev } = stats(d);
  const scheduled = d.content.filter((c) => c.status === "Scheduled").length;
  const cards: [string, string, number, string, string][] = [
    ["content", "Content", d.content.length, `${scheduled} scheduled`, "create"],
    ["funnel", "New in Hivecast", st.New, "from the funnel", "leads"],
    ["funnel", "Nurture", st.Nurture, "not ready yet", "followup"],
    ["paid", "Booked calls", st.Booked, "ready to talk", "calendar"],
    ["paid", "Won", st.Won, `${money(rev)} closed`, "leads"],
    ["paid", "Community", d.posts.length, "posts", "community"],
  ];
  const revBy: [string, number][] = SOURCES.map((s) => [s, d.leads.filter((l) => l.source === s && l.stage === "Won").reduce((a, l) => a + (+l.value || 0), 0)]);
  const up = calItems(d).filter((i) => +new Date(i.t) >= Date.now() - 3.6e6).slice(0, 4);
  return (
    <section className="view">
      <Head eyebrow="Money Board" title="Every lead, from first ad to paying client" lead="Live counts from your database. Tap a stage to work on it." />
      <div className="board">
        {cards.map((c) => (
          <button key={c[1]} className={`stage ${c[0]}`} onClick={() => go(c[4])}>
            <span className="t">{c[1]}</span><span className="n">{c[2]}</span><span className="s">{c[3]}</span>
          </button>
        ))}
      </div>
      <div className="grid2">
        <div className="panel"><h3>Revenue by lead source</h3><Bars pairs={revBy} isMoney />{!rev && <p className="note">No closed income yet. Mark a lead Won and add its value to fill this graph.</p>}</div>
        <div className="panel"><h3>Coming up</h3><div className="cal">{up.length ? up.map((i, n) => <CalRow key={n} i={i} />) : <Empty>Nothing scheduled. Add calls in Calendar.</Empty>}</div></div>
      </div>
    </section>
  );
}

type ChatMsg = { role: "ai" | "me"; text: string };
const CHEF_HELLO: ChatMsg = { role: "ai", text: "Hi, I'm your Marketing Chief. I'll ask a few quick questions and fill everything in for you.\n\nFirst: what's the name of the business we're marketing today?" };

export function Chief({ d }: { d: TeamData }) {
  const toast = useToast();
  const [chat, setChat] = useState<ChatMsg[]>([CHEF_HELLO]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [talk, setTalk] = useState(false);
  const talkRef = useRef(false);
  talkRef.current = talk;
  const chatRef = useRef(chat);
  chatRef.current = chat;
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  // If nothing was heard, listen again (twice) instead of getting stuck.
  const emptyTries = useRef(0);
  const listenRef = useRef<{ start: () => void } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const listen = useListen((spoken) => { emptyTries.current = 0; sendText(spoken); }, () => {
    if (talkRef.current && emptyTries.current < 2) { emptyTries.current++; listenRef.current?.start(); }
  });
  listenRef.current = listen;
  async function say(text: string) { setSpeaking(true); await speak(text); setSpeaking(false); }

  async function sendText(t: string) {
    t = t.trim();
    if (!t) return setErr("Type or speak an answer first.");
    setErr(""); setInput(""); setBusy(true);
    const history = [...chatRef.current, { role: "me" as const, text: t }];
    setChat(history);
    try {
      const r = await api("/api/agents/chef", { history, fields: fieldsRef.current });
      setFields((f) => ({ ...f, ...r.fields }));
      setChat((c) => [...c, { role: "ai", text: r.reply }]);
      if (talkRef.current) {
        await say(r.reply);              // Chief answers out loud…
        if (talkRef.current && !r.done) listen.start(); // …then listens for the next answer
      }
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  function send(e: FormEvent) { e.preventDefault(); sendText(input); }

  // One big button that always does the next sensible thing, so you're never stuck.
  async function mainButton() {
    if (!speechSupported()) return setErr("This browser can't listen. Use Chrome, Edge or Safari, or tap the mic on your keyboard.");
    setErr("");
    if (listen.listening) { listen.stop(); return; }          // done talking: send what was heard
    if (speaking) { stopSpeaking(); emptyTries.current = 0; listen.start(); return; } // skip the reading, answer now
    if (busy) return;
    emptyTries.current = 0;
    if (!talk) {
      setTalk(true); talkRef.current = true;
      // Only read the greeting at the very start; after that, go straight to listening.
      if (chatRef.current.length === 1) await say(chatRef.current[0].text);
      if (talkRef.current) listen.start();
      return;
    }
    listen.start();
  }
  function endTalk() { setTalk(false); talkRef.current = false; stopSpeaking(); listen.stop(); }

  async function save() {
    if (!fields.business_name) return toast("Tell the Chief the business name first");
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("businesses").insert({ ...fields, created_by: u.user?.id });
    toast(error ? `Couldn't save: ${error.message}` : "Business saved");
  }

  return (
    <section className="view">
      <Head eyebrow="Agent 1 · Marketing Chief" title="Talk to the Chief about your business" lead="Tap Start talking. The Chief asks one question at a time out loud, listens to your answer, and fills every field for you. Type only to fix a misheard word." />
      <div className="grid2">
        <div className="panel">
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className={"btn " + (talk ? "honey" : "primary")} onClick={mainButton} style={{ fontSize: 16, padding: "12px 18px" }}>
              {listen.listening ? "● Listening… tap when you're done" : busy ? "Thinking…" : speaking ? "🔊 Speaking… tap to answer now" : talk ? "🎤 Tap to answer" : "🎤 Start talking"}
            </button>
            {talk && <button type="button" className="btn small" onClick={endTalk}>End talking</button>}
            {listen.interim && <span className="note">{listen.interim}</span>}
          </div>
          {listen.error && <p className="err">{listen.error}</p>}
          <div className="chat" aria-live="polite">{chat.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}</div>
          <form className="row" onSubmit={send} style={{ marginTop: 10 }}>
            <input id="chef-in" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Or type here to correct…" autoComplete="off" style={{ flex: 1, minWidth: 0 }} />
            <button className="btn" disabled={busy}>{busy ? "…" : "Send"}</button>
          </form>
          <div className="row" style={{ marginTop: 8 }}>
            <MicButton label="Say one answer" onText={(t) => sendText(t)} />
            <button className="btn small" type="button" disabled={busy} onClick={() => sendText("Skip this one, let's go to the next question.")}>Skip this question</button>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn small" type="button" style={{ marginTop: 8 }} onClick={() => { endTalk(); setChat([CHEF_HELLO]); setFields({}); }}>Start over</button>
        </div>
        <div className="panel">
          <h3>Business profile</h3>
          <div className="slots">{PROFILE_SLOTS.map(([k, l]) => <div className="slot" key={k}><b>{l}</b><span>{fields[k] || ""}</span></div>)}</div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" type="button" onClick={save}>Save business</button>
            <span className="note">Saved businesses feed the Create and Follow-up agents.</span>
          </div>
          <h3 style={{ marginTop: 18 }}>Saved businesses</h3>
          {d.businesses.length ? d.businesses.map((b) => <div className="post" key={b.id}><b>{b.business_name}</b><span className="who">{b.app} · {b.offer}</span></div>) : <p className="note">None yet.</p>}
        </div>
      </div>
    </section>
  );
}

export function Create({ d }: { d: TeamData }) {
  const toast = useToast();
  const names = Array.from(new Set([...BUSINESSES.filter((b) => b !== "Undecided"), ...d.businesses.map((b) => b.business_name)]));
  const [biz, setBiz] = useState(names[0]);
  const [kind, setKind] = useState<(typeof MAKE_KINDS)[number]["id"]>("ai-ad");
  const [tell, setTell] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<any>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [okToUse, setOkToUse] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const K = MAKE_KINDS.find((k) => k.id === kind)!;
  useEffect(() => { if (out && resultRef.current) resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" }); }, [out]);

  // Talking picks the business too, if you name one of them.
  function heard(t: string) {
    setTell((v) => (v ? v + " " : "") + t);
    const hit = names.find((n) => t.toLowerCase().includes(n.toLowerCase()));
    if (hit) setBiz(hit);
  }

  async function go() {
    setErr(""); setBusy(true); setSavedId(null); setOut(null); setMediaUrl(null); setImageUrl("");
    try {
      const profile = d.businesses.find((b) => b.business_name === biz) || { business_name: biz };
      const format = other || K.format;
      const r = await api("/api/agents/create", { format, mode: kind === "ai-video" ? "pro" : "none", vision: tell, profile });
      setOut(r);
      setAutoRun(0); // wait for "Make the video" so a photo can be added first
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const text = out ? `${out.title}\n\n${out.script}${out.shots ? `\n\n${kind === "script" ? "FILMING GUIDE" : "SHOT LIST"}\n${out.shots}` : ""}` : "";

  async function upload(): Promise<string | null> {
    if (!file) return null;
    if (!okToUse) throw new Error("Tick the box to confirm you can use this file.");
    const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase().storage.from("creator-uploads").upload(path, file, { contentType: file.type });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const url = supabase().storage.from("creator-uploads").getPublicUrl(path).data.publicUrl;
    setMediaUrl(url);
    return url;
  }

  // Saves once and remembers the row, so "Make video" and "Save" never create duplicates.
  async function saveRow(): Promise<string | null> {
    if (savedId) return savedId;
    let media = mediaUrl || (await upload());
    // Save the AI-designed ad image too, so it shows in the Library and can be shared.
    if (!media && imageUrl) {
      const blob = await (await fetch(imageUrl)).blob();
      const path = `ai-ad-${Date.now()}.png`;
      const { error: upErr } = await supabase().storage.from("creator-uploads").upload(path, blob, { contentType: "image/png" });
      if (!upErr) media = supabase().storage.from("creator-uploads").getPublicUrl(path).data.publicUrl;
    }
    const { data: u } = await supabase().auth.getUser();
    const { data, error } = await supabase().from("content").insert({
      title: out.title, body: out.script + (out.shots ? `\n\nSHOT LIST\n${out.shots}` : ""), type: out.format, business: biz,
      video_mode: K.label, status: "Draft", created_by: u.user?.id, media_url: media,
    }).select("id").single();
    if (error) throw new Error(`Couldn't save: ${error.message}`);
    setSavedId(data.id);
    return data.id;
  }
  async function save() {
    if (savedId) return toast("Already in your Library");
    try { await saveRow(); toast("Saved to your Library"); } catch (x: any) { toast(x.message); }
  }

  return (
    <section className="view">
      <Head eyebrow="Create" title="What do you want to make?" />
      <div className="kinds">
        {MAKE_KINDS.map((k) => (
          <button key={k.id} type="button" className="kind" aria-pressed={kind === k.id && !other} onClick={() => { setKind(k.id); setOther(""); }}>
            <span className="kind-icon" aria-hidden="true">{k.icon}</span><b>{k.label}</b><small>{k.hint}</small>
          </button>
        ))}
      </div>
      <div className="panel form">
        <label>For<select id="cr-biz" value={biz} onChange={(e) => setBiz(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</select></label>
        <div className="tell">
          <MicButton label="Tell the AI what you want" onText={heard} />
          <textarea value={tell} onChange={(e) => setTell(e.target.value)} placeholder="Or type it. Example: an ad for busy roofers, confident and premium, push the free estimate" />
        </div>
        {kind === "creator" && !other && (
          <div className="form" style={{ gap: 8 }}>
            <label>Upload your video or image (optional now, you can add it later)<input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
            {file && <label className="checkline"><input type="checkbox" checked={okToUse} onChange={(e) => setOkToUse(e.target.checked)} /><span>This is my own work, and anyone shown agreed to be in it.</span></label>}
          </div>
        )}
        <div className="row">
          <button className="btn honey" type="button" onClick={go} disabled={busy} style={{ fontSize: 17, padding: "14px 24px" }}>{busy ? "Working on it…" : other ? "✨ Write it" : `${K.icon} Make my ${K.label}`}</button>
          {err && <span className="err">{err}</span>}
        </div>
        <details>
          <summary className="note" style={{ cursor: "pointer" }}>More writing: emails, texts, sales scripts…</summary>
          <select value={other} onChange={(e) => setOther(e.target.value)} style={{ marginTop: 8 }}>
            <option value="">Choose one</option>
            {CONTENT_FORMATS.filter((f) => !MAKE_KINDS.some((k) => k.format === f)).map((f) => <option key={f}>{f}</option>)}
          </select>
        </details>
      </div>

      {out && (
        <div className="panel form" ref={resultRef}>
          <h3 style={{ margin: 0 }}>{out.title}</h3>
          {out.graphic && <AdImage g={out.graphic} business={biz} onReady={setImageUrl} />}
          {kind === "ai-video" && !other && <VideoMaker words={out.voiceover || out.script} ensureSaved={saveRow} auto={autoRun} />}
          {mediaUrl && (/\.(mp4|mov|webm)$/i.test(mediaUrl) ? <video className="hive-video" src={mediaUrl} controls playsInline /> : <img src={mediaUrl} alt="" style={{ width: "100%", borderRadius: 12 }} />)}
          <details open={kind !== "ai-video"}>
            <summary className="note" style={{ cursor: "pointer" }}>{kind === "script" ? "Your script and filming guide" : kind === "creator" ? "Creator brief" : kind === "ai-ad" ? "Post caption" : "Script"}</summary>
            <div className="out" style={{ marginTop: 6 }}>{text}</div>
          </details>
          <div className="row">
            <button className="btn primary" type="button" onClick={save}>Save to Library</button>
            <button className="btn small" type="button" onClick={() => copyText(text, toast)}>Copy words</button>
            <button className="btn small" type="button" onClick={go} disabled={busy}>↻ Try another</button>
          </div>
          {imageUrl && <p className="note" style={{ margin: 0 }}>Tip: download the image and post it with the caption, or use Share after saving.</p>}
        </div>
      )}
    </section>
  );
}
