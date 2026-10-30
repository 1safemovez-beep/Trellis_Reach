import { NextResponse } from "next/server";
import { BUSINESSES, CALL_CONSENT_TEXT, CLIENT_CONSENT_PROMISE, CLIENT_SERVICES, LEVELS, PATHS, READINESS_AUTH_TEXT, SOURCES } from "@/lib/constants";
import { clean, fail, rateLimited, supabaseAdmin } from "@/lib/server";

// Public lead capture for the Hivecast funnel. Visitors are not signed in, so this route
// validates everything and writes with the service role.
export async function POST(req: Request) {
  if (rateLimited(req, "lead", 8, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong with the form. Please try again.");
  if (clean(b.website)) return NextResponse.json({ ok: true }); // honeypot: bots fill hidden fields

  const kind = ["keep-posted", "qualify", "call-request", "client-signup", "creator-signup"].includes(b.kind) ? b.kind : "qualify";
  const now = new Date().toISOString();
  const email = clean(b.email, 200).toLowerCase();
  const phone = clean(b.phone, 40);
  const consent = Boolean(b.consent);
  if (kind !== "call-request" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("That email doesn't look right.");
  const source = SOURCES.includes(b.source) ? b.source : "Direct";
  const business = BUSINESSES.includes(b.business) ? b.business : "Undecided";
  const notes: string[] = [];
  // Which shared ad or video brought them in.
  const fromAd = clean(b.fromAd, 64);
  if (/^[0-9a-f-]{36}$/i.test(fromAd)) {
    const { data: ad } = await supabaseAdmin().from("content").select("title").eq("id", fromAd).maybeSingle();
    if (ad) notes.push(`Came from shared ad: ${ad.title} (${fromAd})`);
  }
  // Proof of consent, saved before any call can happen.
  const consentNote = (where: string) => `Consent to AI calls/texts given ${now} via ${where}: "${CALL_CONSENT_TEXT}"`;

  let row: Record<string, any>;
  if (kind === "call-request") {
    if (phone.replace(/\D/g, "").length < 10) return fail("Enter your phone number with area code.");
    if (!consent) return fail("Please tick the box to agree to the AI call first.");
    notes.push("Call requested from Hivecast", consentNote("Hivecast call box"));
    row = { name: clean(b.name, 120) || "Call request", email: email || null, phone, business, path: "Requested an AI call", source,
      stage: "New", consent_email: Boolean(email), consent_sms_calls: true };
  } else if (kind === "creator-signup") {
    if (!b.agree) return fail("Please agree to the creator terms.");
    const makes = (Array.isArray(b.makes) ? b.makes : []).map((x: any) => clean(x, 40)).filter(Boolean).slice(0, 8);
    notes.push(`Creator sign-up${makes.length ? `: makes ${makes.join(", ")}` : ""}`, `Agreed to creator terms ${now}`);
    if (clean(b.links, 300)) notes.push(`Work/socials: ${clean(b.links, 300)}`);
    if (/^https:\/\/[\w.-]+\.supabase\.co\/storage\//.test(clean(b.sampleUrl, 500))) notes.push(`Sample work: ${clean(b.sampleUrl, 500)}`);
    if (b.inSample) notes.push(`Agreed ${now}: shown in their sample and QVTrellis may use it to promote the creator program`);
    if (b.tester) notes.push("Wants to be a TESTER");
    if (b.seedLoop) notes.push("Seed Loop founding member waitlist");
    if (consent && phone) notes.push(consentNote("creator sign-up"));
    row = { name: clean(b.name, 120) || email.split("@")[0], email, phone: phone || null, business: "Trellis Reach", path: "Creator",
      source: "Creator", stage: "New", consent_email: true, consent_sms_calls: consent && Boolean(phone) };
  } else if (kind === "client-signup") {
    const company = clean(b.company, 160);
    if (!company) return fail("Enter your business name.");
    const services = (Array.isArray(b.services) ? b.services : []).filter((x: string) => CLIENT_SERVICES.includes(x));
    if (!services.length) return fail("Pick at least one service.");
    if (!b.agree) return fail("Please agree to the client terms.");
    if (services.some((x: string) => /AI phone|booking/i.test(x)) && !b.customerConsent) return fail("Please confirm your customers agree before AI calls them.");
    const wantsReadiness = services.some((x: string) => /readiness/i.test(x));
    if (wantsReadiness && !b.readinessAuth) return fail("Please give permission to test your systems for the readiness check.");
    notes.push(`Client sign-up: ${company}${clean(b.industry, 80) ? ` (${clean(b.industry, 80)})` : ""}${clean(b.site, 200) ? ` · ${clean(b.site, 200)}` : ""}`,
      `Services: ${services.join(", ")}`, `Agreed to client terms ${now}`);
    if (b.customerConsent) notes.push(`Promised ${now}: "${CLIENT_CONSENT_PROMISE}"`);
    if (wantsReadiness) notes.push(`Testing permission given ${now}: "${READINESS_AUTH_TEXT}" NEXT STEP: agree in writing on scope and dates before any testing.`);
    if (consent && phone) notes.push(consentNote("client sign-up"));
    row = { name: `${clean(b.name, 120) || email.split("@")[0]} · ${company}`, email, phone: phone || null, business: "Trellis Reach",
      path: "High-stakes client / business", source, stage: "New", goal: clean(b.goal, 500) || null,
      consent_email: true, consent_sms_calls: consent && Boolean(phone) };
  } else {
    const keepPosted = kind === "keep-posted";
    const path = PATHS.find((p) => p.id === b.pathId)?.name || (keepPosted ? "Keep me posted" : "");
    if (!keepPosted && !path) return fail("Pick who you are first.");
    const level = LEVELS[Number(b.level) - 1]?.[0];
    if (level) notes.push(`Level: ${level}`);
    if (consent && phone) notes.push(consentNote("Hivecast sign-up form"));
    row = { name: clean(b.name, 120) || email.split("@")[0], email, phone: phone || null, business, path, source,
      stage: keepPosted ? "Nurture" : "New", goal: clean(b.goal, 500) || null,
      consent_email: keepPosted || consent, consent_sms_calls: consent && Boolean(phone) };
  }

  const { data, error } = await supabaseAdmin().from("leads").insert({ ...row, notes: notes.join("\n") || null }).select("id").single();
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
