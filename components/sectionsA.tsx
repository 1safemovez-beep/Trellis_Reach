"use client";
import { FormEvent, useRef, useState } from "react";
import { MicButton, speak, speechSupported, stopSpeaking, useListen } from "./voice";
import { api, supabase } from "@/lib/supabaseClient";
import { BUSINESSES, CONTENT_FORMATS, PROFILE_SLOTS, SOURCES, VIDEO_MODES } from "@/lib/constants";
import type { TeamData } from "@/lib/useTeamData";
import { Bars, copyText, Empty, Head, money, useToast, when } from "./ui";
import { PlaySaved, VideoMaker } from "./video";
import { AdPreview, adCopy, isAdFormat } from "./ad";

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
const CHEF_HELLO: ChatMsg = { role: "ai", text: "Hi, I'm your Marketing Chef. I'll ask a few quick questions and fill everything in for you.\n\nFirst: what's the name of the business we're marketing today?" };

export function Chef({ d }: { d: TeamData }) {
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
        await say(r.reply);              // Chef answers out loud…
        if (talkRef.current && !r.done) listen.start(); // …then listens for the next answer
      }
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  function send(e: FormEvent) { e.preventDefault(); sendText(input); }

  async function toggleTalk() {
    if (talk) { setTalk(false); stopSpeaking(); listen.stop(); return; }
    if (!speechSupported()) return setErr("This browser can't listen. Use Chrome, Edge or Safari, or tap the mic on your keyboard.");
    setTalk(true); talkRef.current = true;
    await say(chatRef.current[chatRef.current.length - 1]?.text || "");
    if (talkRef.current) listen.start();
  }

  async function save() {
    if (!fields.business_name) return toast("Tell the Chef the business name first");
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("businesses").insert({ ...fields, created_by: u.user?.id });
    toast(error ? `Couldn't save: ${error.message}` : "Business saved");
  }

  return (
    <section className="view">
      <Head eyebrow="Agent 1 · Marketing Chef" title="Talk to the Chef about your business" lead="Tap Start talking. The Chef asks one question at a time out loud, listens to your answer, and fills every field for you. Type only to fix a misheard word." />
      <div className="grid2">
        <div className="panel">
          <div className="row" style={{ marginBottom: 10 }}>
            <button type="button" className={"btn " + (talk ? "honey" : "primary")} onClick={toggleTalk} style={{ fontSize: 16, padding: "12px 18px" }}>
              {talk ? (listen.listening ? "● Listening… tap to stop" : busy ? "Thinking…" : speaking ? "Speaking… tap to stop" : "Stop talking mode") : "🎤 Start talking"}
            </button>
            {listen.interim && <span className="note">{listen.interim}</span>}
          </div>
          {listen.error && <p className="err">{listen.error}</p>}
          {talk && !listen.listening && !busy && !speaking && (
            <div className="row" style={{ marginBottom: 8 }}>
              <button className="btn honey" type="button" onClick={() => { emptyTries.current = 0; listen.start(); }}>🎤 Tap to answer</button>
              <button className="btn small" type="button" onClick={() => sendText("Skip this one, let's go to the next question.")}>Skip this question</button>
            </div>
          )}
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
          <button className="btn small" type="button" style={{ marginTop: 8 }} onClick={() => { setTalk(false); stopSpeaking(); listen.stop(); setChat([CHEF_HELLO]); setFields({}); }}>Start over</button>
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
  const names = Array.from(new Set([...d.businesses.map((b) => b.business_name), ...BUSINESSES]));
  const [biz, setBiz] = useState(names[0]);
  const [format, setFormat] = useState(CONTENT_FORMATS[0]);
  const [mode, setMode] = useState("none");
  const [consent, setConsent] = useState(false);
  const [desc, setDesc] = useState("");
  const [vision, setVision] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<any>(null);
  const [whenAt, setWhenAt] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  // Two ways to make an ad or commercial: the client works with the AI, or the AI does it all.
  const [how, setHow] = useState<"together" | "ai">("together");
  const [autoRun, setAutoRun] = useState(0);
  const isVideo = /video|commercial|outreach|invite/i.test(format) || mode !== "none";

  async function go() {
    setErr(""); setBusy(true); setSavedId(null);
    try {
      const profile = d.businesses.find((b) => b.business_name === biz) || { business_name: biz };
      const allAI = how === "ai";
      setOut(await api("/api/agents/create", allAI
        ? { format, mode: "pro", profile }
        : { format, mode, photoConsent: consent, description: desc, vision, profile }));
      setAutoRun(allAI && /video|commercial/i.test(format) ? Date.now() : 0);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const text = out ? `${out.title}\n\n${out.script}${out.shots ? `\n\nSHOT LIST\n${out.shots}` : ""}\n\nKey points covered: ${(out.keyPointsCovered || []).join(" · ")}` : "";

  // Saves once and remembers the row, so "Make video" and "Save" never create duplicates.
  async function saveRow(): Promise<string | null> {
    if (savedId) return savedId;
    const { data: u } = await supabase().auth.getUser();
    const { data, error } = await supabase().from("content").insert({
      title: out.title, body: out.script + (out.shots ? `\n\nSHOT LIST\n${out.shots}` : ""), type: out.format, business: biz,
      video_mode: out.mode, status: whenAt ? "Scheduled" : "Draft", scheduled_for: whenAt ? new Date(whenAt).toISOString() : null, created_by: u.user?.id,
    }).select("id").single();
    if (error) throw new Error(`Couldn't save: ${error.message}`);
    setSavedId(data.id);
    return data.id;
  }
  async function save() {
    if (savedId) return toast("Already in your library");
    try { await saveRow(); toast(whenAt ? "Saved and scheduled" : "Saved to library"); } catch (x: any) { toast(x.message); }
  }

  return (
    <section className="view">
      <Head eyebrow="Agent 2 · Creator AI" title="Make ads, videos and scripts" lead="Every script keeps the locked key points: hook, problem, answer, proof and a call to action into Hivecast. The AI never invents results." />
      <div className="grid2">
        <div className="panel form">
          <label>Business<select id="cr-biz" value={biz} onChange={(e) => setBiz(e.target.value)}>{names.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label>What to make<select id="cr-fmt" value={format} onChange={(e) => setFormat(e.target.value)}>{CONTENT_FORMATS.map((f) => <option key={f}>{f}</option>)}</select></label>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>How do you want to make it?</div>
            <div className="modes">
              <button type="button" className="mode" aria-pressed={how === "together"} onClick={() => setHow("together")}><b>🤝 Work with the AI</b><small>You add your vision, photo and words. The AI builds it with you and you approve every line.</small></button>
              <button type="button" className="mode" aria-pressed={how === "ai"} onClick={() => setHow("ai")}><b>⚡ All AI</b><small>One tap. The AI writes it and, for videos and commercials, makes the video too.</small></button>
            </div>
          </div>
          {how === "together" && (<>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Video mode (plug-in slots)</div>
            <div className="modes">{VIDEO_MODES.map((m) => <button key={m.id} type="button" className="mode" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}><b>{m.label}</b><small>{m.hint}</small></button>)}</div>
          </div>
          {mode === "photo" && (<>
            <label>Photo<input id="cr-photo" type="file" accept="image/*" /></label>
            <label style={{ display: "flex", gap: 8, fontWeight: 400 }}><input id="cr-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: "auto" }} /> This is me, or I have written permission from the person in the photo.</label>
            <p className="note" style={{ margin: 0 }}>The photo is sent to the AI video plug-in once it's connected.</p>
          </>)}
          {mode === "describe" && (<>
            <label>Describe the video<textarea id="cr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="A confident founder in a bright studio, upbeat, 30 seconds" /></label>
            <MicButton label="Describe it out loud" onText={(t) => setDesc((v) => (v ? v + " " : "") + t)} />
          </>)}
          <label>Your vision (optional)<textarea id="cr-vision" value={vision} onChange={(e) => setVision(e.target.value)} placeholder="Wardrobe, setting, mood, anything you want in it" /></label>
          <MicButton label="Say your vision" onText={(t) => setVision((v) => (v ? v + " " : "") + t)} />
          </>)}
          <div className="row"><button className="btn primary" type="button" onClick={go} disabled={busy}>{busy ? "Writing…" : how === "ai" ? "⚡ Make it all with AI" : "Create it"}</button>{err && <span className="err">{err}</span>}</div>
        </div>
        <div className="panel">
          <h3>Result</h3>
          {out && isAdFormat(out.format) && <AdPreview business={biz} title={out.title} text={out.voiceover || adCopy(out.script)} />}
          {out ? <div className="out">{text}</div> : <Empty>Your script appears here.</Empty>}
          {out && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary small" type="button" onClick={save}>Save to library</button>
              <button className="btn small" type="button" onClick={() => copyText(text, toast)}>Copy</button>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>Schedule<input id="cr-when" type="datetime-local" value={whenAt} onChange={(e) => setWhenAt(e.target.value)} style={{ width: "auto" }} /></label>
            </div>
          )}
          {out && isVideo && <VideoMaker words={out.voiceover || out.script} ensureSaved={saveRow} auto={autoRun} />}
        </div>
      </div>
      <div className="panel">
        <h3>Content library</h3>
        {d.content.length ? (
          <div className="tablewrap"><table>
            <thead><tr><th>Title</th><th>Type</th><th>Business</th><th>Status</th><th>Goes out</th></tr></thead>
            <tbody>{d.content.map((c) => (
              <tr key={c.id}>
                <td><b>{c.title}</b>{c.example && <> <span className="pill muted">Example</span></>}{isAdFormat(c.type) && <details><summary className="note" style={{ cursor: "pointer" }}>Show ad</summary><AdPreview business={c.business || "Trellis Reach"} title={c.title} text={adCopy(c.body)} /></details>}<details><summary className="note" style={{ cursor: "pointer" }}>Show script</summary><div className="out" style={{ marginTop: 6 }}>{c.body}</div></details></td>
                <td>{c.type}{c.video_mode && c.video_mode !== "No video" && <div className="note">{c.video_mode}</div>}{c.video_id && <PlaySaved videoId={c.video_id} status={c.video_status} />}</td>
                <td>{c.business}</td>
                <td><span className={"pill " + (c.status === "Scheduled" ? "honey" : "muted")}>{c.status}</span></td>
                <td className="num">{when(c.scheduled_for)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <Empty>Nothing saved yet. Create your first ad above.</Empty>}
      </div>
    </section>
  );
}
