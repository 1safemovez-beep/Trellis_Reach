import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server";
import { videoStatus } from "@/lib/heygen";
import { adCopy } from "@/lib/adcopy";

export const dynamic = "force-dynamic";

// Public: ads and videos the owner marked "Use as example".
export async function GET() {
  const { data } = await supabaseAdmin().from("content").select("id, title, body, business, video_id, video_status, media_url")
    .eq("featured", true).order("created_at", { ascending: false }).limit(6);
  const out = await Promise.all((data || []).map(async (c) => {
    let video: string | null = c.media_url && /\.(mp4|mov|webm)(\?|$)/i.test(c.media_url) ? c.media_url : null;
    const image = c.media_url && !video ? c.media_url : null;
    if (c.video_id && c.video_status === "completed") { try { video = (await videoStatus(c.video_id)).url; } catch {} }
    return { id: c.id, title: c.title, business: c.business, text: adCopy(c.body).slice(0, 400), video, image };
  }));
  return NextResponse.json({ examples: out });
}
