"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { money, useToast } from "./ui";

type Plan = { id: string; name: string; monthly: number | null; yearly: number | null; setup_fee: number | null; includes: string | null; payment_plan: string | null; active: boolean; sort: number };

// Admin dashboard: every plan price lives here. The chat AI quotes only what's saved and active.
export function PricePlans() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [admin, setAdmin] = useState(false);
  const load = useCallback(async () => {
    const db = supabase();
    const [{ data }, u] = await Promise.all([db.from("price_plans").select("*").order("sort"), db.auth.getUser()]);
    setPlans((data as Plan[]) || []);
    const { data: tm } = await db.from("team_members").select("role").eq("email", (u.data.user?.email || "").toLowerCase()).maybeSingle();
    setAdmin(["owner", "admin"].includes(tm?.role || ""));
  }, []);
  useEffect(() => { load(); }, [load]);
  const num = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : +v);

  async function save(e: FormEvent<HTMLFormElement>, p: Plan) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const { error } = await supabase().from("price_plans").update({
      name: String(f.get("name") || p.name), monthly: num(f.get("monthly")), yearly: num(f.get("yearly")), setup_fee: num(f.get("setup_fee")),
      includes: String(f.get("includes") || ""), payment_plan: String(f.get("payment_plan") || ""), active: f.get("active") === "on", updated_at: new Date().toISOString(),
    }).eq("id", p.id);
    toast(error ? `Couldn't save: ${error.message}` : `${p.name} saved`); load();
  }
  async function add() {
    const { error } = await supabase().from("price_plans").insert({ name: "New plan", sort: plans.length + 1, active: false });
    if (error) toast(error.message); else load();
  }
  async function remove(p: Plan) {
    if (!window.confirm(`Delete the "${p.name}" plan? This can't be undone.`)) return;
    const { error } = await supabase().from("price_plans").delete().eq("id", p.id);
    toast(error ? error.message : "Plan deleted"); load();
  }
  if (!admin) return null;
  return (
    <div className="panel form">
      <h3 style={{ margin: 0 }}>💲 Plans and prices</h3>
      <p className="note" style={{ margin: 0 }}>All prices live here. Leave a price empty to have it discussed on the call. The chat AI only quotes plans marked "Show". Only owners and admins can change these.</p>
      {plans.map((p) => (
        <form key={p.id + p.sort} className="panel form" style={{ background: "var(--bg)" }} onSubmit={(e) => save(e, p)}>
          <div className="two">
            <label>Plan name<input name="name" defaultValue={p.name} required /></label>
            <label>Monthly ($)<input name="monthly" type="number" min={0} step="1" defaultValue={p.monthly ?? ""} /></label>
            <label>Yearly, paid upfront ($)<input name="yearly" type="number" min={0} step="1" defaultValue={p.yearly ?? ""} /></label>
            <label>Setup fee ($)<input name="setup_fee" type="number" min={0} step="1" defaultValue={p.setup_fee ?? ""} /></label>
          </div>
          <label>What's included<input name="includes" defaultValue={p.includes || ""} /></label>
          <label>Payment plan option<input name="payment_plan" defaultValue={p.payment_plan || ""} placeholder="e.g. 3 payments of $400" /></label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <label className="checkline"><input type="checkbox" name="active" defaultChecked={p.active} /><span>Show (chat AI can quote it)</span></label>
            <div className="row"><button className="btn small primary">Save</button><button className="btn small danger-outline" type="button" onClick={() => remove(p)}>Delete</button></div>
          </div>
          {p.monthly != null && p.yearly != null && p.monthly > 0 && <p className="note" style={{ margin: 0 }}>Yearly saves {money(p.monthly * 12 - p.yearly)} ({Math.round(100 - (p.yearly / (p.monthly * 12)) * 100)}% off).</p>}
        </form>
      ))}
      <div><button className="btn small" type="button" onClick={add}>+ Add a plan</button></div>
    </div>
  );
}
