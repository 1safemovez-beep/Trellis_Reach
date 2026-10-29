import { NextResponse } from "next/server";
import { clean, fail, rateLimited, supabaseAdmin } from "@/lib/server";

// Public "delete my information" request. Contact stops right away and the record is
// flagged; the team deletes it for good from Leads (we can't verify identity here, so
// a stranger can't wipe someone else's record on the spot).
export async function POST(req: Request) {
  if (rateLimited(req, "delete-data", 5, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong. Please try again.");
  if (clean(b.website)) return NextResponse.json({ ok: true });
  if (!b.understand) return fail("Please tick the box to confirm.");
  const email = clean(b.email, 200).toLowerCase();
  const last10 = clean(b.phone, 40).replace(/\D/g, "").slice(-10);
  if (!email && last10.length < 7) return fail("Enter the email or phone number you signed up with.");
  const db = supabaseAdmin();
  const stamp = `DELETE REQUESTED ${new Date().toISOString().slice(0, 10)} · OPTED OUT (all contact)`;
  const { data: rows } = await db.from("leads").select("id, email, phone, notes").limit(5000);
  const matches = (rows || []).filter((l) => (email && (l.email || "").toLowerCase() === email) ||
    (last10.length >= 7 && (l.phone || "").replace(/\D/g, "").endsWith(last10)));
  for (const l of matches) {
    await db.from("leads").update({ consent_email: false, consent_sms_calls: false, notes: [l.notes, stamp].filter(Boolean).join("\n") }).eq("id", l.id);
  }
  return NextResponse.json({ ok: true });
}
