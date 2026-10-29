import { NextResponse } from "next/server";
import { fail, requireTeam, supabaseAdmin } from "@/lib/server";

// Permanently deletes the signed-in person's account and their own posts.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  if (b?.confirm !== "DELETE") return fail('Type DELETE to confirm.');
  const db = supabaseAdmin();
  const token = (req.headers.get("authorization") || "").slice(7);
  const { data } = await db.auth.getUser(token);
  const user = data?.user;
  if (!user) return fail("Your session expired. Please sign in again.", 401);
  const { data: me } = await db.from("team_members").select("role").eq("email", who.email).maybeSingle();
  if (me?.role === "owner") {
    const { count } = await db.from("team_members").select("email", { count: "exact", head: true }).eq("role", "owner");
    if ((count || 0) <= 1) return fail("You're the only owner. Make someone else an owner first, or nobody could run the app.");
  }
  await db.from("posts").delete().eq("author_id", user.id);
  await db.from("team_members").delete().eq("email", who.email);
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return fail("Couldn't delete the account. Please try again or contact support.", 500);
  return NextResponse.json({ ok: true });
}
