import { NextResponse } from "next/server";
import { askJSON, COMPLIANCE_RULES } from "@/lib/ai";
import { CONTENT_FORMATS, VIDEO_MODES } from "@/lib/constants";
import { clean, fail, requireTeam } from "@/lib/server";

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
  try {
    const r = await askJSON<{ title: string; script: string; shots: string; keyPointsCovered: string[] }>({
      maxTokens: 2500,
      system: `You are the Creator AI in Trellis Reach. You write award-quality, persuasive but never pushy marketing for high-stakes clients who must make their money back.
LOCKED key points, in order: 1) a hook in the first 3 seconds or first line, 2) the problem and what it costs, 3) the answer: what the business does, 4) proof, 5) one clear call to action into the Hivecast funnel.
${COMPLIANCE_RULES}
For video formats include a shot list with timing, wardrobe, setting and mood.
JSON shape: {"title": string, "script": string, "shots": string (empty if not video), "keyPointsCovered": [string]}`,
      messages: [{
        role: "user",
        content: `Make: ${format}
Video mode: ${mode.label}${mode.id === "describe" ? ` - owner's description: ${description}` : ""}${mode.id === "pro" ? " - write the full professional commercial exactly to structure" : ""}
Business profile: ${JSON.stringify(b?.profile || {}).slice(0, 3000)}
Owner's vision: ${clean(b?.vision, 1500) || "none given"}`,
      }],
    });
    return NextResponse.json({ ...r, format, mode: mode.label });
  } catch (e: any) {
    return fail(e.message || "Couldn't create that.", 503);
  }
}
