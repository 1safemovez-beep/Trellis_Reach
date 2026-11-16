import { NextResponse } from "next/server";
import { askJSON, COMPLIANCE_RULES } from "@/lib/ai";
import { PROFILE_SLOTS } from "@/lib/constants";
import { clean, fail, requireTeam, supabaseAdmin } from "@/lib/server";
import { knowledge } from "@/lib/knowledge";
import { brandMemory } from "@/lib/brandmemory";

// One-tap campaign: after the voice interview, turns the filled-in profile into a starter
// campaign (a feed ad, a short social post and a nurture email). Everything is saved as a Draft that
// needs client approval, so nothing can go live until the client says yes.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const f: Record<string, string> = {};
  for (const [k] of PROFILE_SLOTS) f[k] = clean(b?.fields?.[k], 500);
  if (!f.business_name) return fail("Tell the Chief the business name first.");
  const db = supabaseAdmin();
  // Save the business once, so Create and Follow-up can use it too.
  const { data: have } = await db.from("businesses").select("id").ilike("business_name", f.business_name).limit(1);
  if (!have?.length) await db.from("businesses").insert({ ...f });
  const about = await knowledge(f.business_name || f.app);
  const memory = await brandMemory(f.business_name);
  try {
    const r = await askJSON<{ ad: { title: string; headline: string; sub: string; cta: string; caption: string }; social: { title: string; text: string }; email: { title: string; subject: string; body: string } }>({
      maxTokens: 3500,
      system: `You are the Creator AI in Trellis Reach. Build a starter campaign for one business from its profile: one designed feed ad, one short social post, one nurture email. Same hook and offer across all three. Plain words, one clear call to action, never pushy.
${COMPLIANCE_RULES}
${about}
${memory}
JSON shape: {"ad": {"title": string, "headline": max 7 words, "sub": max 14 words, "cta": max 4 words, "caption": string}, "social": {"title": string, "text": string}, "email": {"title": string, "subject": string, "body": string}}`,
      messages: [{ role: "user", content: `Business profile: ${JSON.stringify(f)}` }],
    });
    const rows = [
      { title: clean(r.ad?.title, 120) || `${f.business_name} ad`, type: "Designed image ad", body: `${clean(r.ad?.headline, 100)}\n${clean(r.ad?.sub, 200)}\n${clean(r.ad?.cta, 60)}\n\n${clean(r.ad?.caption, 1500)}` },
      { title: clean(r.social?.title, 120) || `${f.business_name} post`, type: "Social post", body: clean(r.social?.text, 2000) },
      { title: clean(r.email?.title, 120) || `${f.business_name} email`, type: "Nurture email", body: `Subject: ${clean(r.email?.subject, 160)}\n\n${clean(r.email?.body, 3000)}` },
    ].filter((x) => x.body.trim().length > 5).map((x) => ({ ...x, business: f.business_name, video_mode: "Words only", status: "Draft", requires_approval: true }));
    if (!rows.length) return fail("The AI didn't return a campaign. Try again.", 503);
    const { data, error } = await db.from("content").insert(rows).select("id, title, type");
    if (error) return fail(`Couldn't save the campaign: ${error.message}`, 500);
    return NextResponse.json({ items: data });
  } catch (e: any) {
    return fail(e.message || "Couldn't build the campaign.", 503);
  }
}
