import { NextResponse } from "next/server";
import { askJSON, COMPLIANCE_RULES } from "@/lib/ai";
import { clean, fail, requireTeam } from "@/lib/server";
import { knowledge } from "@/lib/knowledge";

// Writes a ready-to-post caption for each social network from a saved ad or video.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const title = clean(b?.title, 200);
  const body = clean(b?.body, 3000);
  if (!title && !body) return fail("Pick something to share first.");
  const about = await knowledge(clean(b?.business, 120));
  try {
    const r = await askJSON<Record<string, string>>({
      quick: true,
      maxTokens: 1500,
      system: `You write social captions for Trellis Reach. Match each network's style. Keep the ad's message and call to action; never add claims, numbers or results that aren't in the ad.
${COMPLIANCE_RULES}
${about}
${b?.hasVideo ? 'The video is AI-made: end each caption with "Made with AI".' : ""}
Use [LINK] where the link goes. X stays under 250 characters including [LINK]. Instagram and TikTok can't have clickable links: say "link in bio".
JSON shape: {"facebook": string, "instagram": string, "linkedin": string, "x": string, "tiktok": string}`,
      messages: [{ role: "user", content: `Business: ${clean(b?.business, 120)}\nAd title: ${title}\nAd: ${body}` }],
    });
    return NextResponse.json(r);
  } catch (e: any) {
    return fail(e.message || "Couldn't write captions.", 503);
  }
}
