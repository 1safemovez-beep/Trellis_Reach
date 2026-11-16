import { NextResponse } from "next/server";
import { adCopy } from "@/lib/adcopy";
import { CALLER } from "@/lib/constants";
import { clean, fail, rateLimited, requireTeam, supabaseAdmin } from "@/lib/server";

const UUID = /^[0-9a-f-]{36}$/i;

// GET ?id= : public. Shows the client the ad they are being asked to approve.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!UUID.test(id)) return fail("Approval link not found.", 404);
  const db = supabaseAdmin();
  const { data: ap } = await db.from("ad_approvals").select("id, content_id, client_name, status, feedback, decided_at").eq("id", id).maybeSingle();
  if (!ap) return fail("Approval link not found.", 404);
  const { data: ad } = await db.from("content").select("title, body, business, media_url, video_mode").eq("id", ap.content_id).maybeSingle();
  if (!ad) return fail("Approval link not found.", 404);
  return NextResponse.json({ ...ap, title: ad.title, business: ad.business, media_url: ad.media_url, text: adCopy(ad.body), company: CALLER.company });
}

// POST: the team asks a client to approve an ad ({ action: "request" }), or the client decides
// ({ action: "decide", id, decision: "approve" | "changes", feedback }). Nothing is posted by this route.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong. Please try again.");
  const db = supabaseAdmin();

  if (b.action === "decide") {
    if (rateLimited(req, "approval-decide", 10, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
    const id = clean(b.id, 64);
    if (!UUID.test(id)) return fail("Approval link not found.", 404);
    const decision = b.decision === "approve" ? "Approved" : b.decision === "changes" ? "Changes requested" : "";
    if (!decision) return fail("Choose approve or request changes.");
    const feedback = clean(b.feedback, 1500);
    if (decision === "Changes requested" && feedback.length < 3) return fail("Tell us what to change.");
    const { data: ap } = await db.from("ad_approvals").select("id, content_id, status").eq("id", id).maybeSingle();
    if (!ap) return fail("Approval link not found.", 404);
    if (ap.status !== "Pending") return NextResponse.json({ ok: true, status: ap.status });
    await db.from("ad_approvals").update({ status: decision, feedback: feedback || null, decided_at: new Date().toISOString() }).eq("id", id);
    // Feed what the client said into brand memory, so the next ad starts from it.
    const { data: ad } = await db.from("content").select("title, body, business").eq("id", ap.content_id).maybeSingle();
    if (ad?.business) {
      const note = decision === "Approved" ? `${ad.title}: ${adCopy(ad.body).slice(0, 300)}` : feedback;
      await db.from("brand_memory").insert({ business_name: ad.business, kind: decision === "Approved" ? "approved_ad" : "client_feedback", note });
    }
    return NextResponse.json({ ok: true, status: decision });
  }

  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const contentId = clean(b.contentId, 64);
  if (!UUID.test(contentId)) return fail("Pick an ad first.");
  const { data: ad } = await db.from("content").select("id").eq("id", contentId).maybeSingle();
  if (!ad) return fail("Ad not found.", 404);
  // Turn approval on for this ad first. From here it can't be set Live or Scheduled until it's approved.
  await db.from("content").update({ requires_approval: true }).eq("id", contentId);
  const { data, error } = await db.from("ad_approvals").insert({
    content_id: contentId, client_name: clean(b.clientName, 120) || null, client_email: clean(b.clientEmail, 200).toLowerCase() || null,
  }).select("id").single();
  if (error) return fail("Couldn't create the approval link.", 500);
  return NextResponse.json({ id: data.id });
}
