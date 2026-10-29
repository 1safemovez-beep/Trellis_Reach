import { NextResponse } from "next/server";
import { OPTED_OUT } from "@/lib/constants";
import { clean, fail, rateLimited, supabaseAdmin } from "@/lib/server";

// Public opt-out. Anyone can stop AI calls, texts or emails by email or phone number.
// Matching leads lose their consent and are marked so no agent will contact them again.
export async function POST(req: Request) {
  if (rateLimited(req, "optout", 6, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong. Please try again.");
  if (clean(b.website)) return NextResponse.json({ ok: true }); // bot trap
  const email = clean(b.email, 200).toLowerCase();
  const digits = clean(b.phone, 40).replace(/\D/g, "");
  const what = ["all", "calls", "emails"].includes(b.what) ? b.what : "all";
  if (!email && digits.length < 7) return fail("Enter the email or phone number you want removed.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn't look right.");

  const db = supabaseAdmin();
  const stamp = `${OPTED_OUT} (${what === "all" ? "all contact" : what}) ${new Date().toISOString().slice(0, 10)}`;
  const { data: rows } = await db.from("leads").select("id, email, phone, notes").limit(5000);
  const last10 = digits.slice(-10);
  const matches = (rows || []).filter((l) =>
    (email && (l.email || "").toLowerCase() === email) ||
    (last10.length >= 7 && (l.phone || "").replace(/\D/g, "").endsWith(last10)));

  for (const l of matches) {
    const patch: Record<string, any> = { notes: [l.notes, stamp].filter(Boolean).join("\n") };
    if (what !== "emails") patch.consent_sms_calls = false;
    if (what !== "calls") patch.consent_email = false;
    await db.from("leads").update(patch).eq("id", l.id);
  }
  // Not a lead yet? Keep a record so the team knows never to contact them.
  if (!matches.length) {
    await db.from("leads").insert({
      name: email ? email.split("@")[0] : "Opt-out request", email: email || null, phone: digits || null,
      business: "Undecided", path: "Opted out", source: "Direct", stage: "Lost",
      consent_email: false, consent_sms_calls: false, notes: stamp,
    });
  }
  return NextResponse.json({ ok: true });
}
