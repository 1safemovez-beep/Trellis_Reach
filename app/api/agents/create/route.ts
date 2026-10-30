import { NextResponse } from "next/server";
import { askJSON, COMPLIANCE_RULES } from "@/lib/ai";
import { CONTENT_FORMATS, SALES_GUIDES, VIDEO_MODES } from "@/lib/constants";
import { clean, fail, requireTeam } from "@/lib/server";
import { knowledge } from "@/lib/knowledge";

// Agent 2: Creator AI. Writes ads, video scripts and messages with locked key points.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const format = CONTENT_FORMATS.includes(b?.format) ? b.format : CONTENT_FORMATS[0];
  const mode = VIDEO_MODES.find((m) => m.id === b?.mode) || VIDEO_MODES[0];
  if (mode.id === "photo" && !b?.photoConsent) return fail("Confirm you have permission to use the photo.");
  const description = clean(b?.description, 1500);
  if (mode.id === "describe" && !description) return fail("Describe the video first.");
  const about = await knowledge(b?.profile?.business_name || b?.profile?.app);
  try {
    const r = await askJSON<{ title: string; script: string; shots: string; voiceover: string; keyPointsCovered: string[]; graphic?: any }>({
      maxTokens: 4000,
      system: `You are the Creator AI in Trellis Reach: a world-class direct-response creative director. Write as if this client pays $20,000 a week and every ad must bring customers and close deals. Persuasive, specific and premium, never pushy or hyped.
Use proven direct-response structure (hook, problem and its cost, the shift, the answer, proof, risk-reversal, one clear call to action). Plain words, short lines, one idea per line. Speak to one ideal customer. Lead with the outcome they want, not features.
LOCKED key points, in order: 1) a hook in the first 3 seconds or first line, 2) the problem and what it costs, 3) the answer: what the business does, 4) proof, 5) one clear call to action into the Hivecast funnel.
${COMPLIANCE_RULES}
${about}
When the business is one of ours, the ad is for that app or program: use what we know about it as the source of truth.
For video formats include a shot list with timing, wardrobe, setting and mood.
${format === "Designed image ad" ? 'This is a single designed image ad (feed post). Also return "graphic": {"headline": max 7 words, "sub": max 14 words, "cta": max 4 words, "badge": max 3 words or ""} for the image itself. "script" is the post caption. "shots" is empty.' : ""}
${format === "Self-film video script" ? 'The client films this themselves, in their own style. "script" is a teleprompter-ready script in short lines, with [PAUSE] marks. "shots" is a simple filming guide: phone setup, light, framing, wardrobe, setting, b-roll ideas, and 3 tips to look and sound confident.' : ""}
${format === "Creator brief" ? 'This is a brief for a human creator who will make the ad or video. "script" is the brief: goal, ideal viewer, the message, must-say lines, the hook options (3), call to action, do/don\'t list, length and format. "shots" is a suggested shot list.' : ""}
"voiceover" is ONLY the exact words a presenter says out loud, in order: no labels, stage directions, brackets, emojis or timing notes. Keep it under 1,300 characters.
JSON shape: {"title": string, "script": string, "shots": string (empty if not video), "voiceover": string, "keyPointsCovered": [string], "graphic"?: {"headline": string, "sub": string, "cta": string, "badge": string}}`,
      messages: [{
        role: "user",
        content: `Make: ${format}
${SALES_GUIDES[format] ? `How to write it: ${SALES_GUIDES[format]}\n` : ""}Video mode: ${mode.label}${mode.id === "describe" ? ` - owner's description: ${description}` : ""}${mode.id === "pro" ? " - write the full professional commercial exactly to structure" : ""}
Business profile: ${JSON.stringify(b?.profile || {}).slice(0, 3000)}
What the owner told the AI: ${clean(b?.vision, 2000) || "nothing extra; use the business profile and what we know"}`,
      }],
    });
    return NextResponse.json({ ...r, format, mode: mode.label });
  } catch (e: any) {
    return fail(e.message || "Couldn't create that.", 503);
  }
}
