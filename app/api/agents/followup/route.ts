import { NextResponse } from "next/server";
import { askJSON, COMPLIANCE_RULES } from "@/lib/ai";
import { OPTED_OUT, STAGES } from "@/lib/constants";
import { clean, fail, requireTeam, supabaseAdmin } from "@/lib/server";

// Agent 3: Follow-up AI. Drafts a gentle message for a lead and suggests the next step.
// Nothing is sent from here: a person approves first, and sending switches on with the
// email and Twilio plug-ins.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const channel = ["Email", "SMS", "AI phone script"].includes(b?.channel) ? b.channel : "Email";
  const { data: lead } = await supabaseAdmin().from("leads").select("*").eq("id", clean(b?.leadId, 64)).maybeSingle();
  if (!lead) return fail("Pick a lead first.");
  if ((lead.notes || "").includes(OPTED_OUT)) return fail("This person opted out. Don't contact them.");
  if (channel !== "Email" && !lead.consent_sms_calls) return fail("This lead hasn't agreed to texts or calls. Use email.");
  if (channel === "Email" && !lead.consent_email && lead.stage !== "Booked") return fail("This lead hasn't agreed to marketing emails.");
  try {
    const r = await askJSON<{ subject: string; message: string; nextStep: string; suggestedStage: string }>({
      system: `You are the Follow-up AI in Trellis Reach. Draft a gentle ${channel} for this lead and suggest the next step.
Give one clear, easy next step (book a call, watch the path video, or reply). Nurture leads get one useful tip. Booked leads get a friendly reminder and the placeholder [VIDEO LINK] for the watch-before-your-call video. Lost leads get a short, respectful check-in for later. SMS stays under 300 characters.
${COMPLIANCE_RULES}
JSON shape: {"subject": string (empty unless email), "message": string, "nextStep": string, "suggestedStage": one of ${JSON.stringify(STAGES)}}`,
      messages: [{
        role: "user",
        content: `Business name for the opening line: ${lead.business || "QVTrellis"}
Lead: ${JSON.stringify({ name: lead.name, business: lead.business, path: lead.path, stage: lead.stage, goal: lead.goal, notes: lead.notes })}
Owner's note: ${clean(b?.note, 1000) || "none"}`,
      }],
    });
    if (!STAGES.includes(r.suggestedStage as any)) r.suggestedStage = lead.stage;
    return NextResponse.json({ ...r, channel });
  } catch (e: any) {
    return fail(e.message || "Couldn't draft that.", 503);
  }
}
