import { NextResponse } from "next/server";
import { videoStatus } from "@/lib/heygen";
import { clean, fail, requireTeam, supabaseAdmin } from "@/lib/server";

// Checks a video and returns a fresh link to play it.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const videoId = clean(b?.videoId, 200);
  if (!videoId) return fail("Unknown video.");
  try {
    const s = await videoStatus(videoId);
    if (s.status === "completed" || s.status === "failed") {
      await supabaseAdmin().from("content").update({ video_status: s.status }).eq("video_id", videoId);
    }
    return NextResponse.json(s);
  } catch (e: any) {
    return fail(e.message, 503);
  }
}
