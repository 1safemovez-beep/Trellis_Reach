import { NextResponse } from "next/server";
import { clean, fail, requireTeam, supabaseAdmin } from "@/lib/server";

// Puts a Hive Challenge winner into the real pipeline: it becomes a Draft ad, tagged as a winner test,
// that needs client approval before it can go live. Its views, clicks and leads then show in Results.
// Owners and admins only. Safe to tap twice: it never makes a second copy.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const db = supabaseAdmin();
  const { data: me } = await db.from("team_members").select("role").eq("email", who.email).maybeSingle();
  if (!["owner", "admin"].includes(me?.role || "")) return fail("Only owners and admins can test a winner.", 403);
  const b = await req.json().catch(() => null);
  const challengeId = clean(b?.challengeId, 64);
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return fail("Pick a challenge.");
  const { data: ch } = await db.from("challenges").select("client, business, winner_entry").eq("id", challengeId).maybeSingle();
  if (!ch?.winner_entry) return fail("Pick a winner first.");
  const { data: have } = await db.from("content").select("id").eq("source_entry_id", ch.winner_entry).maybeSingle();
  if (have) return NextResponse.json({ id: have.id, already: true });
  const { data: e } = await db.from("challenge_entries").select("title, copy, media_url, safety_ok").eq("id", ch.winner_entry).maybeSingle();
  if (!e) return fail("Winning entry not found.");
  if (e.safety_ok === false) return fail("This entry failed the safety check. Fix it first.");
  const { data, error } = await db.from("content").insert({
    title: `Winner test: ${e.title}`.slice(0, 120), body: e.copy, type: "Winner test", business: ch.business || ch.client,
    video_mode: "Creator-made", status: "Draft", media_url: e.media_url, requires_approval: true, source_entry_id: ch.winner_entry,
  }).select("id").single();
  if (error) return fail(`Couldn't start the test: ${error.message}`, 500);
  return NextResponse.json({ id: data.id });
}
