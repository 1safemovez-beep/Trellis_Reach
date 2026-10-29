import { NextResponse } from "next/server";
import { BUSINESSES, LEVELS, PATHS, SOURCES } from "@/lib/constants";
import { clean, fail, rateLimited, supabaseAdmin } from "@/lib/server";

// Public lead capture for the Hivecast funnel. Visitors are not signed in, so this route
// validates everything and writes with the service role.
export async function POST(req: Request) {
  if (rateLimited(req, "lead", 8, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong with the form. Please try again.");
  if (clean(b.website)) return NextResponse.json({ ok: true }); // honeypot: bots fill hidden fields

  const email = clean(b.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  const keepPosted = b.kind === "keep-posted";
  const name = clean(b.name, 120) || email.split("@")[0];
  const path = PATHS.find((p) => p.id === b.pathId)?.name || (keepPosted ? "Keep me posted" : "");
  if (!keepPosted && !path) return fail("Pick who you are first.");
  const business = BUSINESSES.includes(b.business) ? b.business : "Undecided";
  const source = SOURCES.includes(b.source) ? b.source : "Direct";
  const phone = clean(b.phone, 40);
  const consent = Boolean(b.consent);
  const level = LEVELS[Number(b.level) - 1]?.[0];

  const { data, error } = await supabaseAdmin()
    .from("leads")
    .insert({
      name, email, phone: phone || null, business, path, source,
      stage: keepPosted ? "Nurture" : "New",
      goal: clean(b.goal, 500) || null,
      notes: level ? `Level: ${level}` : null,
      consent_email: keepPosted || consent,
      consent_sms_calls: consent && Boolean(phone),
    })
    .select("id")
    .single();
  if (error) {
    console.error("lead insert", error.message);
    return fail("We couldn't save that just now. Please try again.", 500);
  }
  return NextResponse.json({ ok: true, id: data.id });
}

// Visitor says "Not ready yet" after the path video: move their lead to Nurture.
export async function PATCH(req: Request) {
  if (rateLimited(req, "lead-patch", 10, 60_000)) return fail("Too many tries.", 429);
  const b = await req.json().catch(() => null);
  const id = clean(b?.id, 64);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Unknown lead.");
  const { error } = await supabaseAdmin().from("leads").update({ stage: "Nurture" }).eq("id", id).eq("stage", "New");
  if (error) return fail("Couldn't update.", 500);
  return NextResponse.json({ ok: true });
}
