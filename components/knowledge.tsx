"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "./ui";
import { MicButton } from "./voice";

type Row = { name: string; about: string; sort: number };

// Admin dashboard: what every AI agent knows about your businesses and apps.
export function AppKnowledge() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [admin, setAdmin] = useState(false);
  const [newName, setNewName] = useState("");
  const load = useCallback(async () => {
    const db = supabase();
    const [{ data }, u] = await Promise.all([db.from("app_knowledge").select("*").order("sort"), db.auth.getUser()]);
    setRows((data as Row[]) || []);
    const { data: tm } = await db.from("team_members").select("role").eq("email", (u.data.user?.email || "").toLowerCase()).maybeSingle();
    setAdmin(["owner", "admin"].includes(tm?.role || ""));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function save(r: Row) {
    const { error } = await supabase().from("app_knowledge").update({ about: r.about, updated_at: new Date().toISOString() }).eq("name", r.name);
    toast(error ? `Couldn't save: ${error.message}` : `Saved. The AI now knows the new ${r.name} details.`);
  }
  async function add() {
    const name = newName.trim();
    if (!name) return;
    const { error } = await supabase().from("app_knowledge").insert({ name, about: "", sort: rows.length + 1 });
    if (error) toast(error.message); else { setNewName(""); load(); }
  }
  async function remove(r: Row) {
    if (!window.confirm(`Remove what the AI knows about ${r.name}? This can't be undone.`)) return;
    const { error } = await supabase().from("app_knowledge").delete().eq("name", r.name);
    toast(error ? error.message : "Removed"); load();
  }
  if (!admin) return null;
  return (
    <div className="panel form">
      <h3 style={{ margin: 0 }}>🧠 What the AI knows about your apps</h3>
      <p className="note" style={{ margin: 0 }}>Every agent (Chef, Creator, Follow-up, captions, the Hive judge and the Hivecast chat) uses these. Describe what each app is, who it's for and its goal. Changes reach the AI within a minute.</p>
      {rows.map((r, i) => (
        <div key={r.name} className="form" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <label>{r.name}<textarea value={r.about} onChange={(e) => setRows((v) => v.map((x, j) => (j === i ? { ...x, about: e.target.value } : x)))} placeholder="What it is, who it's for, its main goal" style={{ minHeight: 90 }} /></label>
          <div className="row">
            <MicButton label="Say it" onText={(t) => setRows((v) => v.map((x, j) => (j === i ? { ...x, about: (x.about ? x.about + " " : "") + t } : x)))} />
            <button className="btn small primary" type="button" onClick={() => save(rows[i])}>Save</button>
            <button className="btn small danger-outline" type="button" onClick={() => remove(r)}>Remove</button>
          </div>
        </div>
      ))}
      <div className="row"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add an app, e.g. AngelzPulse" style={{ flex: 1, minWidth: 0 }} /><button className="btn small" type="button" onClick={add}>+ Add</button></div>
    </div>
  );
}
