"use client";
import { FormEvent, useEffect, useState } from "react";
import { api, supabase } from "@/lib/supabaseClient";
import { BUSINESSES, LEVELS, PATHS, SOURCES, STAGES } from "@/lib/constants";
import type { TeamData } from "@/lib/useTeamData";
import { Bars, copyText, Empty, Head, money, useToast, when } from "./ui";
import { calItems, CalRow, stats } from "./sectionsA";
import { MicButton } from "./voice";

async function exportExcel(d: TeamData) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Trellis Reach";
  const sheet = (name: string, rows: Record<string, any>[]) => {
    const ws = wb.addWorksheet(name);
    if (!rows.length) { ws.addRow(["No rows yet"]); return; }
    ws.columns = Object.keys(rows[0]).map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(12, k.length + 4)) }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };
  };
  sheet("Leads", d.leads.map(({ id, ...r }) => r));
  sheet("By source", SOURCES.map((s) => {
    const won = d.leads.filter((l) => l.source === s && l.stage === "Won");
    return { Source: s, Leads: d.leads.filter((l) => l.source === s).length, Won: won.length, Income: won.reduce((a, l) => a + (+l.value || 0), 0) };
  }));
  sheet("Content", d.content.map(({ id, ...r }) => r));
  sheet("Calendar", d.bookings.map(({ id, ...r }) => r));
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url; a.download = `trellis-reach-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Leads({ d }: { d: TeamData }) {
  const toast = useToast();
  const [fStage, setFStage] = useState("");
  const [fSrc, setFSrc] = useState("");
  const { st, rev, total } = stats(d);
  const conv = total ? Math.round((st.Won / total) * 100) : 0;
  const rows = d.leads.filter((l) => (!fStage || l.stage === fStage) && (!fSrc || l.source === fSrc));

  async function patch(id: string, p: Record<string, any>, msg: string) {
    const { error } = await supabase().from("leads").update(p).eq("id", id);
    toast(error ? `Couldn't update: ${error.message}` : msg);
  }
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase().from("leads").insert({ ...f, value: +f.value || 0, consent_email: false, consent_sms_calls: false });
    if (error) toast(`Couldn't add: ${error.message}`); else { (e.target as HTMLFormElement).reset(); toast("Lead added"); }
  }

  return (
    <section className="view">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Head eyebrow="Data center" title="Leads and income" lead={`${total} leads · ${st.Won} won · ${money(rev)} closed · ${conv}% close rate. See the Graphs tab for charts.`} />
        <button className="btn primary" type="button" onClick={() => exportExcel(d).catch((x) => toast(`Export failed: ${x.message}`))}>Download Excel</button>
      </div>
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>All leads</h3>
          <div className="row">
            <select id="f-stage" value={fStage} onChange={(e) => setFStage(e.target.value)} style={{ width: "auto" }}><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
            <select id="f-src" value={fSrc} onChange={(e) => setFSrc(e.target.value)} style={{ width: "auto" }}><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        </div>
        <div className="tablewrap cards"><table>
          <thead><tr><th>Name</th><th>Business / path</th><th>Source</th><th>Stage</th><th>Value</th><th>Closer</th><th>Added</th></tr></thead>
          <tbody>{rows.length ? rows.map((l) => (
            <tr key={l.id}>
              <td data-label="Name"><b>{l.name}</b>{l.example && <> <span className="pill muted">Example</span></>}<div className="note">{l.email}{l.phone ? ` · ${l.phone}` : ""}</div></td>
              <td data-label="Business / path">{l.business}<div className="note">{l.path}</div></td>
              <td data-label="Source">{l.source}</td>
              <td data-label="Stage"><select aria-label="Stage" value={l.stage} onChange={(e) => patch(l.id, { stage: e.target.value }, e.target.value === "Won" ? "Won! Add the deal value" : "Stage updated")}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></td>
              <td className="num" data-label="Value"><input type="number" min={0} aria-label="Deal value" defaultValue={l.value || ""} onBlur={(e) => +e.target.value !== +l.value && patch(l.id, { value: +e.target.value || 0 }, "Value saved")} style={{ width: 90, padding: "4px 6px", fontSize: 13 }} /></td>
              <td data-label="Closer"><input aria-label="Closer" defaultValue={l.closer || ""} onBlur={(e) => e.target.value !== (l.closer || "") && patch(l.id, { closer: e.target.value }, "Closer saved")} style={{ width: 100, padding: "4px 6px", fontSize: 13 }} /></td>
              <td className="num" data-label="Added">{when(l.created_at)}</td>
            </tr>
          )) : <tr><td colSpan={7}><Empty>No leads match.</Empty></td></tr>}</tbody>
        </table></div>
      </div>
      <details className="panel">
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Add a lead by hand</summary>
        <form className="form" onSubmit={add} style={{ marginTop: 10 }}>
          <div className="two">
            <label>Name<input id="al-name" name="name" required /></label>
            <label>Email<input id="al-email" name="email" type="email" /></label>
            <label>Phone<input id="al-phone" name="phone" /></label>
            <label>Business<select id="al-biz" name="business">{BUSINESSES.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label>Path<select id="al-path" name="path">{PATHS.map((p) => <option key={p.id}>{p.name}</option>)}</select></label>
            <label>Source<select id="al-src" name="source">{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Stage<select id="al-stage" name="stage">{STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Value ($)<input id="al-val" name="value" type="number" min={0} /></label>
            <label>Closer<input id="al-closer" name="closer" placeholder="Alicia" /></label>
          </div>
          <label>Notes<textarea id="al-notes" name="notes" /></label>
          <MicButton label="Say the notes" onText={(t) => { const el = document.getElementById("al-notes") as HTMLTextAreaElement | null; if (el) el.value = (el.value ? el.value + " " : "") + t; }} />
          <div><button className="btn primary">Add lead</button></div>
        </form>
      </details>
    </section>
  );
}

// Graphs tab: the black "graph room" with neon charts.
export function Graphs({ d }: { d: TeamData }) {
  const { st, rev, total } = stats(d);
  const conv = total ? Math.round((st.Won / total) * 100) : 0;
  const won = d.leads.filter((l) => l.stage === "Won");
  const byBiz: [string, number][] = Array.from(new Set(d.leads.map((l) => l.business || "Undecided")))
    .map((b) => [b, d.leads.filter((l) => (l.business || "Undecided") === b).length] as [string, number])
    .sort((a, b) => b[1] - a[1]).slice(0, 8);
  const days: [string, number][] = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (13 - i));
    const next = +day + 864e5;
    return [day.toLocaleDateString([], { month: "short", day: "numeric" }), d.leads.filter((l) => +new Date(l.created_at) >= +day && +new Date(l.created_at) < next).length];
  });
  return (
    <section className="view noir">
      <Head eyebrow="Graphs" title="How the money is moving" lead="Live from your database. Every sign-up, booking and win updates these right away." />
      <div className="kpis">
        {([["Leads", total], ["Booked", st.Booked], ["Won", st.Won], ["Close rate", conv + "%"], ["Income", money(rev)]] as [string, any][]).map(([l, v]) => (
          <div className="kpi" key={l}><div className="v">{v}</div><div className="l">{l}</div></div>
        ))}
      </div>
      <div className="grid2">
        <div className="panel"><h3>Leads by source</h3><Bars pairs={SOURCES.map((s) => [s, d.leads.filter((l) => l.source === s).length])} />{!total && <p className="note">No leads yet. Each Hivecast sign-up adds to this graph.</p>}</div>
        <div className="panel pipeline"><h3>Pipeline</h3><Bars pairs={STAGES.map((s) => [s, st[s]])} /></div>
        <div className="panel"><h3>Income by source</h3><Bars isMoney pairs={SOURCES.map((s) => [s, won.filter((l) => l.source === s).reduce((a, l) => a + (+l.value || 0), 0)])} />{!rev && <p className="note">Mark a lead Won and add its value to fill this graph.</p>}</div>
        <div className="panel pipeline"><h3>New leads, last 14 days</h3><Bars pairs={days} /></div>
        <div className="panel"><h3>Leads by business</h3>{byBiz.length ? <Bars pairs={byBiz} /> : <p className="note">Shows once leads arrive.</p>}</div>
      </div>
    </section>
  );
}

export function FollowUp({ d }: { d: TeamData }) {
  const toast = useToast();
  const [leadId, setLeadId] = useState("");
  const [channel, setChannel] = useState("Email");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<any>(null);
  useEffect(() => { if (!leadId && d.leads[0]) setLeadId(d.leads[0].id); }, [d.leads, leadId]);
  const lead = d.leads.find((l) => l.id === leadId);
  const text = out ? `${out.subject ? `Subject: ${out.subject}\n\n` : ""}${out.message}\n\nNext step: ${out.nextStep}\nSuggested stage: ${out.suggestedStage}` : "";

  async function go() {
    setErr(""); setBusy(true);
    try { setOut(await api("/api/agents/followup", { leadId, channel, note })); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  async function saveDraft() {
    const { error } = await supabase().from("content").insert({ title: `${out.channel} to ${lead?.name}`, body: (out.subject ? `Subject: ${out.subject}\n\n` : "") + out.message, type: `${out.channel} follow-up`, business: lead?.business, status: "Draft" });
    toast(error ? `Couldn't save: ${error.message}` : "Draft saved");
  }
  async function moveStage() {
    const { error } = await supabase().from("leads").update({ stage: out.suggestedStage }).eq("id", leadId);
    toast(error ? `Couldn't update: ${error.message}` : `Moved to ${out.suggestedStage}`);
  }

  return (
    <section className="view">
      <Head eyebrow="Agent 3 · Follow-up AI" title="Gentle follow-up and next steps" lead="Pick a lead. The AI drafts the right message for their stage and suggests what happens next. You approve before anything goes out." />
      <div className="grid2">
        <div className="panel form">
          <label>Lead<select id="fu-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)}>{d.leads.length ? d.leads.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.stage}</option>) : <option value="">No leads yet</option>}</select></label>
          <label>Channel<select id="fu-chan" value={channel} onChange={(e) => setChannel(e.target.value)}><option>Email</option><option>SMS</option><option>AI phone script</option></select></label>
          <label>Anything to add?<textarea id="fu-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. They asked about yearly pricing" /></label>
          <MicButton label="Say a note" onText={(t) => setNote((v) => (v ? v + " " : "") + t)} />
          <div className="row"><button className="btn primary" type="button" onClick={go} disabled={busy || !leadId}>{busy ? "Drafting…" : "Draft follow-up"}</button>{err && <span className="err">{err}</span>}</div>
          <p className="note">Texts and calls only go to leads who gave consent. Sending switches on with the Twilio and email plug-ins.</p>
        </div>
        <div className="panel">
          <h3>Draft</h3>
          {out ? <div className="out">{text}</div> : <Empty>The draft appears here.</Empty>}
          {out && (
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn primary small" type="button" onClick={saveDraft}>Save draft</button>
              <button className="btn small" type="button" onClick={moveStage}>Move to {out.suggestedStage}</button>
              <button className="btn small" type="button" onClick={() => copyText(text, toast)}>Copy</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function Calendar({ d }: { d: TeamData }) {
  const toast = useToast();
  const items = calItems(d);
  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase().from("bookings").insert({ title: f.title, kind: f.kind, starts_at: new Date(f.when).toISOString(), who: f.who, business: f.business });
    if (error) toast(`Couldn't add: ${error.message}`); else { (e.target as HTMLFormElement).reset(); toast("Added to calendar"); }
  }
  return (
    <section className="view">
      <Head eyebrow="Calendar" title="Calls, webinars and commercials going out" />
      <div className="grid2">
        <div className="panel"><div className="cal">{items.length ? items.map((i, n) => <CalRow key={n} i={i} />) : <Empty>Nothing on the calendar yet.</Empty>}</div></div>
        <form className="panel form" onSubmit={add}>
          <h3>Add to the calendar</h3>
          <label>What<input id="c-title" name="title" required placeholder="Booking call with Maria" /></label>
          <MicButton label="Say what it is" onText={(t) => { const el = document.getElementById("c-title") as HTMLInputElement | null; if (el) el.value = t; }} />
          <div className="two">
            <label>Type<select id="c-kind" name="kind"><option>Booking call</option><option>Webinar</option><option>Commercial goes live</option><option>Follow-up</option></select></label>
            <label>When<input id="c-when" name="when" type="datetime-local" required /></label>
            <label>Who takes it<input id="c-who" name="who" placeholder="Alicia" /></label>
            <label>Business<select id="c-biz" name="business">{BUSINESSES.map((b) => <option key={b}>{b}</option>)}</select></label>
          </div>
          <div><button className="btn primary">Add</button></div>
          <p className="note">Two-way sync with Google Calendar or Cal.com switches on with the calendar plug-in.</p>
        </form>
      </div>
    </section>
  );
}

function inviteLink(level: number) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/?level=${level + 1}`;
}

export function Community({ d }: { d: TeamData }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  // People who signed up through a level's invite link carry "Level: <name>" in their notes.
  const joined = (name: string) => d.leads.filter((l) => (l.notes || "").includes(`Level: ${name}`));
  async function post(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return toast("Write something first");
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("posts").insert({ text: text.trim(), author_id: u.user?.id });
    if (error) toast(`Couldn't post: ${error.message}`); else setText("");
  }
  return (
    <section className="view">
      <Head eyebrow="Trellis Reach community · paid" title="Who can do what" lead="The mall lobby community is free. This one is for people working the marketing, and each level unlocks more." />
      <div className="grid2">
        <div className="panel">
          <p className="note" style={{ marginTop: 0 }}>Tap a level to see who joined and get its invite link.</p>
          <div className="levels">{LEVELS.map((l, i) => {
            const people = joined(l[0]);
            const isOpen = open === i;
            return (
              <div key={l[0]}>
                <button type="button" className="level" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>
                  <span className="lv">L{i + 1}</span>
                  <div><b>{l[0]}</b> {people.length > 0 && <span className="pill honey">{people.length} joined</span>}<div className="note">{l[1]}</div></div>
                </button>
                {isOpen && (
                  <div className="level-open">
                    <div className="row">
                      <button className="btn primary small" type="button" onClick={() => copyText(inviteLink(i), toast)}>Copy invite link</button>
                      <a className="btn small" href={inviteLink(i)} target="_blank" rel="noreferrer">Preview sign-up ↗</a>
                    </div>
                    <span className="note">Anyone who signs up with this link lands in Leads &amp; Data tagged with this level.</span>
                    {people.length ? people.slice(0, 8).map((p) => <div className="post" key={p.id}><b>{p.name}</b><span className="who">{p.email} · {p.stage} · {when(p.created_at)}</span></div>)
                      : <span className="note">No one has joined this level yet.</span>}
                  </div>
                )}
              </div>
            );
          })}</div>
        </div>
        <div className="panel">
          <h3>Community board</h3>
          <form className="row" onSubmit={post}><input id="post-in" value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a win or ask a question" style={{ flex: 1, minWidth: 0 }} /><button className="btn primary">Post</button></form>
          <div style={{ marginTop: 8 }}><MicButton label="Say your post" onText={(t) => setText((v) => (v ? v + " " : "") + t)} /></div>
          <div style={{ marginTop: 8 }}>{d.posts.length ? d.posts.map((p) => <div className="post" key={p.id}><span className="who">{p.author_email?.split("@")[0] || "Member"} · {when(p.created_at)}</span><span>{p.text}</span></div>) : <Empty>No posts yet. Share the first win.</Empty>}</div>
        </div>
      </div>
    </section>
  );
}

export function Settings({ d }: { d: TeamData }) {
  const toast = useToast();
  const [plugins, setPlugins] = useState<any[]>([]);
  useEffect(() => { api("/api/plugins", {}).then((r) => setPlugins(r.plugins)).catch(() => {}); }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase().from("settings").update({ app_name: f.app_name, tagline: f.tagline, logo: f.logo.toUpperCase(), support_email: f.support_email || null, updated_at: new Date().toISOString() }).eq("id", "brand");
    toast(error ? `Couldn't save: ${error.message}` : "Brand saved");
  }
  async function clearExamples() {
    let n = 0;
    for (const t of ["leads", "content", "bookings"]) {
      const { count } = await supabase().from(t).delete({ count: "exact" }).eq("example", true);
      n += count || 0;
    }
    toast(n ? `Removed ${n} example rows` : "No example rows left");
  }
  return (
    <section className="view">
      <Head eyebrow="Settings" title="Brand and plug-ins" lead="Change the name and logo here at any time. White-label clients set their own." />
      <div className="grid2">
        <form className="panel form" onSubmit={save} key={d.brand.app_name + d.brand.logo}>
          <h3>Brand</h3>
          <label>App name<input id="s-name" name="app_name" defaultValue={d.brand.app_name} /></label>
          <label>Tagline<input id="s-tag" name="tagline" defaultValue={d.brand.tagline} /></label>
          <label>Logo letters<input id="s-logo" name="logo" maxLength={3} defaultValue={d.brand.logo} /></label>
          <label>Human support email<input id="s-support" name="support_email" type="email" defaultValue={d.brand.support_email || ""} /></label>
          <div><button className="btn primary">Save brand</button></div>
          <p className="note">Only owners and admins can change these.</p>
        </form>
        <div className="panel">
          <h3>Plug-ins</h3>
          {plugins.map((p) => (
            <div className="plug" key={p.name}><b>{p.name}</b><span className={"pill " + (p.connected ? "" : "muted")}>{p.connected ? "Key added" : "Not connected"}</span><small>{p.detail}</small></div>
          ))}
          <p className="note">Plug-ins switch on when their key is added to the server's environment settings.</p>
        </div>
      </div>
      <div className="panel">
        <h3>Example data</h3>
        <p className="note">Rows marked "Example" show how the app works. Remove them when real leads arrive.</p>
        <button className="btn small" type="button" onClick={clearExamples}>Remove example rows</button>
      </div>
    </section>
  );
}
