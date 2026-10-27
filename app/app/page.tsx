"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useTeamData } from "@/lib/useTeamData";
import { ToastProvider } from "@/components/ui";
import { Board, Chef, Create } from "@/components/sectionsA";
import { Calendar, Community, FollowUp, Leads, Settings } from "@/components/sectionsB";

const TABS = [
  ["board", "Money Board"], ["chef", "Marketing Chef"], ["create", "Create"], ["leads", "Leads & Data"],
  ["followup", "Follow-up"], ["calendar", "Calendar"], ["community", "Community"], ["settings", "Settings"],
] as const;

// Team dashboard. Requires a signed-in team member; row level security enforces the same rule on the database.
export default function Dashboard() {
  const [status, setStatus] = useState<"checking" | "out" | "notTeam" | "in">("checking");
  const [myEmail, setMyEmail] = useState("");
  const [tab, setTab] = useState("board");
  const d = useTeamData(status === "in");

  useEffect(() => {
    const db = supabase();
    // Signed in is not enough: the email must be on the team list, or every table reads as empty.
    async function check(session: any) {
      if (!session) return setStatus("out");
      const email = String(session.user?.email || "").toLowerCase();
      setMyEmail(email);
      const { data } = await db.from("team_members").select("email").eq("email", email).maybeSingle();
      setStatus(data ? "in" : "notTeam");
    }
    db.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => { check(s); });
    try { const t = localStorage.getItem("tr-tab"); if (t) setTab(t); } catch {}
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (status === "out") window.location.href = "/login"; }, [status]);

  function go(t: string) {
    setTab(t);
    try { localStorage.setItem("tr-tab", t); } catch {}
    window.scrollTo(0, 0);
  }

  if (status === "notTeam") return (
    <main className="wrap">
      <div className="login panel">
        <h2>Almost there</h2>
        <p>You're signed in as <b>{myEmail}</b>, but this email isn't on the team list yet.</p>
        <p className="note">Owner: in Supabase, open SQL Editor → New query, paste this line and click Run. Then reload this page.</p>
        <pre className="out" style={{ whiteSpace: "pre-wrap", userSelect: "all" }}>{`insert into team_members (email, role) values ('${myEmail}', 'owner');`}</pre>
        <div className="row">
          <button className="btn primary" onClick={() => window.location.reload()}>I've added it, reload</button>
          <button className="btn small" onClick={() => supabase().auth.signOut()}>Sign out</button>
        </div>
      </div>
    </main>
  );

  if (status !== "in") return <main className="wrap"><p className="note" style={{ paddingTop: 40 }}>Loading…</p></main>;

  return (
    <ToastProvider>
      <header>
        <div className="wrap">
          <div className="brand">
            <div className="logo">{d.brand.logo}</div>
            <div><h1>{d.brand.app_name}</h1><small>{d.brand.tagline}</small></div>
            <div className="status">
              {d.error ? <span className="err">{d.error.includes("permission") ? "Not on the team list" : d.error}</span> : <><span style={{ color: "var(--good)" }}>●</span> Live</>}
              <br /><button className="btn small" onClick={() => supabase().auth.signOut()}>Sign out</button>
            </div>
          </div>
          <nav aria-label="Sections">
            {TABS.map(([id, label]) => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => go(id)}>{label}</button>)}
            <a className="btn small" href="/" target="_blank" rel="noreferrer" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>Open Hivecast ↗</a>
          </nav>
        </div>
      </header>
      <main className="wrap">
        {tab === "board" && <Board d={d} go={go} />}
        {tab === "chef" && <Chef d={d} />}
        {tab === "create" && <Create d={d} />}
        {tab === "leads" && <Leads d={d} />}
        {tab === "followup" && <FollowUp d={d} />}
        {tab === "calendar" && <Calendar d={d} />}
        {tab === "community" && <Community d={d} />}
        {tab === "settings" && <Settings d={d} />}
      </main>
    </ToastProvider>
  );
}
