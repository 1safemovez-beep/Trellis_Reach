"use client";
import { useCallback, useEffect, useState } from "react";
import { api, supabase } from "@/lib/supabaseClient";
import type { TeamData } from "@/lib/useTeamData";
import { copyText, Empty, Head, money, useToast, when } from "./ui";

type Stat = { content_id: string; views: number; clicks: number; leads: number; won: number; won_value: number };
type Approval = { id: string; content_id: string; client_name: string | null; status: string; feedback: string | null; created_at: string };
type Memory = { id: string; business_name: string; kind: string; note: string };

const KINDS: [string, string][] = [["voice", "How they sound"], ["do", "Always do"], ["dont", "Never do"]];

// Results & Clients: results per ad, the client approval step, and what we remember about each client.
export function Results({ d }: { d: TeamData }) {
  const toast = useToast();
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [apps, setApps] = useState<Approval[]>([]);
  const [mem, setMem] = useState<Memory[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [biz, setBiz] = useState("");
  const [kind, setKind] = useState("voice");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const db = supabase();
    const [s, a, m] = await Promise.all([
      db.from("ad_stats").select("*"),
      db.from("ad_approvals").select("id, content_id, client_name, status, feedback, created_at").order("created_at", { ascending: false }),
      db.from("brand_memory").select("id, business_name, kind, note").order("created_at", { ascending: false }).limit(300),
    ]);
    // These tables come from supabase/migrations/2026-11-16_elevate_tweaks.sql
    setSetupNeeded(Boolean(s.error || a.error || m.error));
    setStats(Object.fromEntries(((s.data as Stat[]) || []).map((x) => [x.content_id, x])));
    setApps((a.data as Approval[]) || []);
    setMem((m.data as Memory[]) || []);
  }, []);
  useEffect(() => { load(); }, [load, d.content.length]);

  const names = Array.from(new Set(d.businesses.map((b) => b.business_name)));
  const latest = (id: string) => apps.find((a) => a.content_id === id);

  async function askClient(id: string) {
    const clientName = window.prompt("Client's name (optional):") ?? "";
    try {
      const r = await api("/api/approval", { action: "request", contentId: id, clientName });
      setLinks((l) => ({ ...l, [id]: `${window.location.origin}/approve/${r.id}` }));
      toast("Approval link ready. Send it to your client."); load();
    } catch (x: any) { toast(x.message); }
  }
  async function addMemory() {
    if (!biz || note.trim().length < 3) return toast("Pick a business and write a note.");
    const { error } = await supabase().from("brand_memory").insert({ business_name: biz, kind, note: note.trim().slice(0, 400) });
    if (error) return toast(`Couldn't save: ${error.message}`);
    setNote(""); toast("Remembered"); load();
  }
  async function forget(id: string) {
    if (!window.confirm("Remove this from the brand memory?")) return;
    const { error } = await supabase().from("brand_memory").delete().eq("id", id);
    toast(error ? error.message : "Removed"); load();
  }

  const items = d.content.filter((c) => c.status !== "Archived");
  const labelOf = (k: string) => ({ voice: "Voice", do: "Do", dont: "Don't", approved_ad: "Approved ad", client_feedback: "Client asked" } as Record<string, string>)[k] || k;

  return (
    <section className="view">
      <Head eyebrow="Results & Clients" title="What's working, and what clients approved"
        lead="See views, clicks and leads for every shared ad. Ask a client to approve before anything goes live, and keep what each client likes in the brand memory." />
      {setupNeeded && <div className="warn"><b>One setup step:</b> run <code>supabase/migrations/2026-11-16_elevate_tweaks.sql</code> once in Supabase → SQL Editor, then reload. Until then this page stays empty.</div>}

      <div className="panel">
        <h3>Results per ad</h3>
        {!items.length ? <Empty>No ads yet. Make one in Create.</Empty> : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Ad</th><th>Views</th><th>Clicks</th><th>Leads</th><th>Won</th><th>Income</th><th>Client approval</th></tr></thead>
              <tbody>
                {items.map((c) => {
                  const s = stats[c.id]; const a = latest(c.id);
                  return (
                    <tr key={c.id}>
                      <td><b>{c.title}</b><br /><span className="note">{c.business} · {c.status}{c.type === "Winner test" ? " · 🧪 winner test" : ""}</span></td>
                      <td>{s?.views ?? 0}</td><td>{s?.clicks ?? 0}</td><td>{s?.leads ?? 0}</td><td>{s?.won ?? 0}</td><td>{money(s?.won_value ?? 0)}</td>
                      <td>
                        {a ? <span className={"pill " + (a.status === "Approved" ? "" : a.status === "Pending" ? "muted" : "honey")}>{a.status === "Approved" ? "✓ Approved" : a.status === "Pending" ? "⏳ Waiting for client" : "✎ Changes asked"}</span> : <span className="note">Not asked</span>}
                        {a?.status === "Changes requested" && a.feedback && <div className="note">“{a.feedback}”</div>}
                        {a?.status !== "Approved" && <div><button className="btn small" type="button" onClick={() => askClient(c.id)}>{a ? "New link" : "Ask client to approve"}</button></div>}
                        {links[c.id] && <div className="row" style={{ marginTop: 4 }}><input readOnly value={links[c.id]} style={{ minWidth: 0, flex: 1 }} /><button className="btn small" type="button" onClick={() => copyText(links[c.id], toast)}>Copy</button></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="note">Views and clicks count visits to the shared ad link. Leads count people who signed up after coming from that ad. Once you ask a client to approve, the ad can't be set to Live or Scheduled until they approve.</p>
      </div>

      <div className="panel form">
        <h3>Brand memory</h3>
        <p className="note" style={{ margin: 0 }}>Every new ad and contest score for that business uses this. Client approvals and change requests are added here for you.</p>
        <div className="two">
          <label>Business<select value={biz} onChange={(e) => setBiz(e.target.value)}><option value="">Choose</option>{names.map((n) => <option key={n}>{n}</option>)}</select></label>
          <label>Kind<select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Warm and plain-spoken. Never mention price first." /></label>
        <div><button className="btn primary" type="button" onClick={addMemory}>Remember this</button></div>
        {!mem.length ? <p className="note">Nothing remembered yet.</p> : mem.map((m) => (
          <div className="post" key={m.id}>
            <div className="row" style={{ justifyContent: "space-between" }}><b>{m.business_name} · {labelOf(m.kind)}</b><button className="btn small danger-outline" type="button" onClick={() => forget(m.id)}>Remove</button></div>
            <span className="who">{m.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
