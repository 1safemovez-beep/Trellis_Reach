"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, supabase } from "@/lib/supabaseClient";
import { BUSINESSES } from "@/lib/constants";
import type { TeamData } from "@/lib/useTeamData";
import { Empty, Head, money, useToast, when } from "./ui";
import { MicButton } from "./voice";
import { EMPTY_RELEASE, ReleaseBox, releaseReady, saveRelease, SignLink, type ReleaseInfo } from "./release";

type Rules = { cash_pct: number; credit_pct: number; high_stakes_min: number; both_over_min: boolean; finalists: number };
type Challenge = { id: string; month: string; client: string; business: string | null; brief: string; budget: number; status: string; winner_entry: string | null; created_at: string };
type Entry = { id: string; challenge_id: string; creator_id: string; creator_email: string | null; title: string; copy: string; content_id: string | null;
  ai_score: number | null; ai_notes: string | null; safety_ok: boolean | null; status: string; payout_choice: string | null; payout_cash: number; payout_credits: number; created_at: string };

const DEFAULT_RULES: Rules = { cash_pct: 10, credit_pct: 15, high_stakes_min: 3000, both_over_min: true, finalists: 5 };

// What the winner earns for a challenge, from the editable rules.
export function prizeFor(budget: number, r: Rules, choice?: string | null) {
  const cash = Math.round((budget * r.cash_pct) / 100);
  const credits = Math.round((budget * r.credit_pct) / 100);
  const both = r.both_over_min && budget >= r.high_stakes_min;
  if (both) return { both: true, cash, credits, label: `${money(cash)} cash + ${credits.toLocaleString()} credits` };
  if (choice === "credits") return { both: false, cash: 0, credits, label: `${credits.toLocaleString()} credits` };
  if (choice === "cash") return { both: false, cash, credits: 0, label: `${money(cash)} cash` };
  return { both: false, cash, credits, label: `${money(cash)} cash or ${credits.toLocaleString()} credits` };
}

function useHive() {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [me, setMe] = useState<{ id: string; email: string; admin: boolean }>({ id: "", email: "", admin: false });
  const load = useCallback(async () => {
    const db = supabase();
    const [r, c, e, u] = await Promise.all([
      db.from("challenge_rules").select("*").eq("id", "rules").maybeSingle(),
      db.from("challenges").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("challenge_entries").select("*").order("created_at", { ascending: false }).limit(2000),
      db.auth.getUser(),
    ]);
    if (r.data) setRules({ ...DEFAULT_RULES, ...(r.data as Rules) });
    setChallenges((c.data as Challenge[]) || []);
    setEntries((e.data as Entry[]) || []);
    const email = (u.data.user?.email || "").toLowerCase();
    const { data: tm } = await db.from("team_members").select("role").eq("email", email).maybeSingle();
    setMe({ id: u.data.user?.id || "", email, admin: ["owner", "admin"].includes(tm?.role || "") });
  }, []);
  useEffect(() => {
    load();
    const ch = supabase().channel("hive").on("postgres_changes", { event: "*", schema: "public", table: "challenge_entries" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_rules" }, load).subscribe();
    return () => { supabase().removeChannel(ch); };
  }, [load]);
  return { rules, challenges, entries, me, load };
}

// Admin dashboard panel: the prize rules, all changeable.
export function HiveRules() {
  const toast = useToast();
  const { rules, me } = useHive();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const patch = { cash_pct: +f.cash_pct || 0, credit_pct: +f.credit_pct || 0, high_stakes_min: +f.high_stakes_min || 0, both_over_min: f.both_over_min === "on", finalists: Math.max(1, Math.min(10, +f.finalists || 5)), updated_at: new Date().toISOString() };
    const { error } = await supabase().from("challenge_rules").update(patch).eq("id", "rules");
    toast(error ? `Couldn't save: ${error.message}` : "Hive Challenge rules saved");
  }
  if (!me.admin) return null;
  return (
    <form className="panel form" onSubmit={save} key={JSON.stringify(rules)}>
      <h3 style={{ margin: 0 }}>🏆 Hive Challenge prize rules</h3>
      <p className="note" style={{ margin: 0 }}>The winner earns a % of what the client pays for the ads. Credits pay a bigger % than cash. Only owners and admins can change these.</p>
      <div className="two">
        <label>Cash bonus (% of ad purchase)<input name="cash_pct" type="number" min={0} max={100} step="0.5" defaultValue={rules.cash_pct} /></label>
        <label>Credit bonus (% of ad purchase)<input name="credit_pct" type="number" min={0} max={200} step="0.5" defaultValue={rules.credit_pct} /></label>
        <label>High-stakes ad purchase starts at ($)<input name="high_stakes_min" type="number" min={0} step="100" defaultValue={rules.high_stakes_min} /></label>
        <label>Finalists the client sees<input name="finalists" type="number" min={1} max={10} defaultValue={rules.finalists} /></label>
      </div>
      <label className="checkline"><input type="checkbox" name="both_over_min" defaultChecked={rules.both_over_min} /><span>At or above the high-stakes amount, the winner gets both cash and credits</span></label>
      <p className="note" style={{ margin: 0 }}>Example on a {money(rules.high_stakes_min)} ad purchase: {prizeFor(rules.high_stakes_min, rules).label}. On {money(1000)}: {prizeFor(1000, rules).label}.</p>
      <div><button className="btn primary">Save rules</button></div>
    </form>
  );
}

// Hive Challenge tab: monthly creator contest for each client's ad.
export function HiveChallenge({ d }: { d: TeamData }) {
  const toast = useToast();
  const { rules, challenges, entries, me } = useHive();
  const [brief, setBrief] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copy, setCopy] = useState("");
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [entryRelease, setEntryRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);
  const [entryOk, setEntryOk] = useState(false);
  const [signId, setSignId] = useState("");
  const name = (email: string | null) => (email || "creator").split("@")[0];

  async function createChallenge(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const { error } = await supabase().from("challenges").insert({ month: new Date().toLocaleDateString([], { month: "long", year: "numeric" }), client: f.client, business: f.business, brief, budget: +f.budget || 0 });
    if (error) toast(`Couldn't create: ${error.message}`); else { (e.target as HTMLFormElement).reset(); setBrief(""); toast("Challenge is open"); }
  }
  async function submitEntry(e: FormEvent<HTMLFormElement>, c: Challenge) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    let media: string | null = null;
    if (entryFile) {
      if (!entryOk) return toast("Tick: you own this or have permission.");
      if (!releaseReady(entryRelease)) return toast("Finish the release: who's shown and their name.");
      const path = `hive-${Date.now()}-${entryFile.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase().storage.from("creator-uploads").upload(path, entryFile, { contentType: entryFile.type });
      if (up.error) return toast(`Upload failed: ${up.error.message}`);
      media = supabase().storage.from("creator-uploads").getPublicUrl(path).data.publicUrl;
    }
    const { data, error } = await supabase().from("challenge_entries").insert({
      challenge_id: c.id, title: f.title, copy, content_id: f.content_id || null, creator_id: me.id, media_url: media,
      payout_choice: prizeFor(c.budget, rules).both ? "both" : f.choice || "cash",
    }).select("id").single();
    if (error) return toast(`Couldn't submit: ${error.message}`);
    if (media) { try { const r = await saveRelease(entryRelease, { mediaUrl: media, entryId: data.id }); if (r?.status === "Pending") setSignId(r.id); } catch {} }
    (e.target as HTMLFormElement).reset(); setCopy(""); setEntryFile(null); setEntryRelease(EMPTY_RELEASE); setEntryOk(false);
    toast("Submitted. The AI judge is scoring it…");
    api("/api/agents/judge", { entryId: data.id }).then((r) => toast(r.safety_ok ? `Scored ${r.ai_score}/100` : "Needs fixes. See the judge's notes.")).catch((x) => toast(x.message));
  }
  async function startJudging(c: Challenge) {
    const list = entries.filter((x) => x.challenge_id === c.id && x.safety_ok && x.status !== "Needs fixes").sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
    if (!list.length) return toast("No safe, scored entries yet.");
    const top = list.slice(0, rules.finalists).map((x) => x.id);
    const rest = list.slice(rules.finalists).map((x) => x.id);
    await supabase().from("challenge_entries").update({ status: "Finalist" }).in("id", top);
    if (rest.length) await supabase().from("challenge_entries").update({ status: "Not picked" }).in("id", rest);
    await supabase().from("challenges").update({ status: "Judging" }).eq("id", c.id);
    toast(`Top ${top.length} are ready for the client to pick`);
  }
  async function pickWinner(c: Challenge, x: Entry) {
    const p = prizeFor(c.budget, rules, x.payout_choice);
    if (!window.confirm(`Pick "${x.title}" by ${name(x.creator_email)} as the winner?\n\nPrize: ${p.label}`)) return;
    await supabase().from("challenge_entries").update({ status: "Winner", payout_cash: p.cash, payout_credits: p.credits }).eq("id", x.id);
    await supabase().from("challenge_entries").update({ status: "Not picked" }).eq("challenge_id", c.id).eq("status", "Finalist").neq("id", x.id);
    await supabase().from("challenges").update({ status: "Winner picked", winner_entry: x.id }).eq("id", c.id);
    toast("👑 Winner crowned");
  }
  async function rejudge(x: Entry) {
    try { const r = await api("/api/agents/judge", { entryId: x.id }); toast(r.safety_ok ? `Scored ${r.ai_score}/100` : "Still needs fixes"); } catch (y: any) { toast(y.message); }
  }

  // Leaderboard: wins, cash earned and credit balance per creator.
  const board = Object.values(entries.reduce((acc, x) => {
    const k = x.creator_email || x.creator_id;
    acc[k] = acc[k] || { who: name(x.creator_email), entries: 0, wins: 0, cash: 0, credits: 0, best: 0 };
    acc[k].entries++; acc[k].best = Math.max(acc[k].best, x.ai_score || 0);
    if (x.status === "Winner") { acc[k].wins++; acc[k].cash += +x.payout_cash || 0; acc[k].credits += +x.payout_credits || 0; }
    return acc;
  }, {} as Record<string, { who: string; entries: number; wins: number; cash: number; credits: number; best: number }>)).sort((a, b) => b.wins - a.wins || b.best - a.best);

  return (
    <section className="view">
      <Head eyebrow="Hive Challenge · monthly" title="Creators compete to make the winning ad" lead={`The AI checks every entry for safety and scores it. The top ${rules.finalists} go to the client, who picks the winner. Winners earn ${rules.cash_pct}% cash or ${rules.credit_pct}% in credits${rules.both_over_min ? `, or both on ad purchases of ${money(rules.high_stakes_min)}+` : ""}.`} />
      {me.admin && (
        <details className="panel">
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>➕ Open a new challenge</summary>
          <form className="form" onSubmit={createChallenge} style={{ marginTop: 10 }}>
            <div className="two">
              <label>Client<input name="client" required placeholder="Client or business name" /></label>
              <label>Mall business<select name="business">{BUSINESSES.map((b) => <option key={b}>{b}</option>)}</select></label>
              <label>Ad purchase ($)<input name="budget" type="number" min={0} step="50" required /></label>
            </div>
            <label>Brief<textarea value={brief} onChange={(e) => setBrief(e.target.value)} required placeholder="Who it's for, their problem, the offer, the look and mood, what to avoid" /></label>
            <MicButton label="Say the brief" onText={(t) => setBrief((v) => (v ? v + " " : "") + t)} />
            <div><button className="btn honey">Open challenge</button></div>
          </form>
        </details>
      )}
      {signId && <SignLink id={signId} />}
      {!challenges.length ? <Empty>No challenges yet.{me.admin ? " Open the first one above." : " Check back on the 1st."}</Empty> : challenges.map((c) => {
        const list = entries.filter((x) => x.challenge_id === c.id).sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0));
        const mine = list.filter((x) => x.creator_id === me.id);
        const prize = prizeFor(c.budget, rules);
        const isOpen = openId === c.id;
        return (
          <div className="panel" key={c.id} style={{ display: "grid", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><span className="eyebrow">{c.month} · {c.business}</span><h3 style={{ margin: 0 }}>{c.client}</h3></div>
              <div className="row"><span className={"pill " + (c.status === "Open" ? "" : "honey")}>{c.status}</span><span className="pill honey">Prize: {prize.label}</span></div>
            </div>
            <p className="note" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.brief}</p>
            <div className="row">
              <button className="btn small" type="button" onClick={() => setOpenId(isOpen ? null : c.id)}>{isOpen ? "Hide" : `Entries (${list.length})${c.status === "Open" ? " · Enter" : ""}`}</button>
              {me.admin && c.status === "Open" && <button className="btn small primary" type="button" onClick={() => startJudging(c)}>Close entries · pick top {rules.finalists}</button>}
            </div>
            {isOpen && (<>
              {c.status === "Open" && (
                <form className="form panel" onSubmit={(e) => submitEntry(e, c)} style={{ background: "var(--bg)" }}>
                  <h3 style={{ margin: 0 }}>Your entry</h3>
                  <label>Title<input name="title" required /></label>
                  <label>Ad copy or video script<textarea value={copy} onChange={(e) => setCopy(e.target.value)} required style={{ minHeight: 120 }} /></label>
                  <MicButton label="Say your ad" onText={(t) => setCopy((v) => (v ? v + " " : "") + t)} />
                  <label>Upload your image or video (optional)<input type="file" accept="image/*,video/*" onChange={(e) => setEntryFile(e.target.files?.[0] || null)} /></label>
                  {entryFile && (<>
                    <label className="checkline"><input type="checkbox" checked={entryOk} onChange={(e) => setEntryOk(e.target.checked)} /><span>I own this or have permission to use it.</span></label>
                    <ReleaseBox value={entryRelease} onChange={setEntryRelease} defaultBusiness={c.client} />
                  </>)}
                  <label>Or attach one from your library (optional)<select name="content_id"><option value="">None</option>{d.content.map((x) => <option key={x.id} value={x.id}>{x.title}{x.video_id ? " 🎬" : ""}</option>)}</select></label>
                  {!prize.both && <label>If I win, pay me in<select name="choice"><option value="cash">Cash ({rules.cash_pct}%)</option><option value="credits">Credits ({rules.credit_pct}%, worth more)</option></select></label>}
                  <p className="note" style={{ margin: 0 }}>By entering you confirm it's your own work, anyone shown agreed, and the client may use it if it wins. Entries that don't win stay yours.</p>
                  <div><button className="btn honey">Submit entry</button></div>
                </form>
              )}
              {list.filter((x) => me.admin || x.creator_id === me.id || ["Finalist", "Winner"].includes(x.status)).map((x) => (
                <div className="post" key={x.id} style={{ gap: 6 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <b>{x.status === "Winner" ? "👑 " : ""}{x.title}</b>
                    <div className="row">
                      {x.ai_score != null && <span className="pill">{x.ai_score}/100</span>}
                      <span className={"pill " + (x.status === "Needs fixes" ? "bad" : x.status === "Winner" || x.status === "Finalist" ? "honey" : "muted")}>{x.status}</span>
                    </div>
                  </div>
                  <span className="who">by {name(x.creator_email)} · {when(x.created_at)}{x.status === "Winner" ? ` · won ${prizeFor(c.budget, rules, x.payout_choice).label}` : ""}</span>
                  {(x as any).media_url && (/\.(mp4|mov|webm)(\?|$)/i.test((x as any).media_url) ? <video className="hive-video" src={(x as any).media_url} controls playsInline style={{ maxWidth: 420 }} /> : <img src={(x as any).media_url} alt="" style={{ maxWidth: 420, width: "100%", borderRadius: 12 }} />)}
                  <div className="out">{x.copy}</div>
                  {x.ai_notes && (me.admin || x.creator_id === me.id) && <p className="note" style={{ margin: 0 }}>🤖 Judge: {x.ai_notes}</p>}
                  <div className="row">
                    {x.creator_id === me.id && x.status === "Needs fixes" && <button className="btn small" type="button" onClick={() => rejudge(x)}>I fixed it, check again</button>}
                    {me.admin && c.status === "Judging" && x.status === "Finalist" && <button className="btn small honey" type="button" onClick={() => pickWinner(c, x)}>👑 Client picks this one</button>}
                  </div>
                </div>
              ))}
              {!list.length && <p className="note">No entries yet.</p>}
              {!me.admin && !mine.length && c.status !== "Open" && <p className="note">Entries are closed for this one.</p>}
            </>)}
          </div>
        );
      })}
      <div className="panel">
        <h3>Leaderboard</h3>
        {board.length ? (
          <div className="tablewrap"><table style={{ minWidth: 0 }}>
            <thead><tr><th>Creator</th><th>Wins</th><th>Best score</th><th>Cash earned</th><th>Credit balance</th></tr></thead>
            <tbody>{board.map((r) => <tr key={r.who}><td>{r.wins ? "👑 " : ""}{r.who}</td><td className="num">{r.wins}</td><td className="num">{r.best}</td><td className="num">{money(r.cash)}</td><td className="num">{r.credits.toLocaleString()}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="note">The leaderboard fills in as creators enter.</p>}
        <p className="note">Cash and credits are recorded here. Automatic payouts switch on with the Payments (Stripe) plug-in.</p>
      </div>
    </section>
  );
}
