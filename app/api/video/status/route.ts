import { NextResponse } from "next/server";
import { logError, videoStatus } from "@/lib/heygen";
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
    // Save whatever HeyGen says each time, so it can be checked from the database.
    await supabaseAdmin().from("content").update({ video_status: s.status === "failed" ? `failed: ${String(s.error || "").slice(0, 200)}` : s.status }).eq("video_id", videoId);
    if (s.status === "failed") await logError("video status", `${videoId} ${s.error || ""}`);
    return NextResponse.json(s);
  } catch (e: any) {
    await logError("video status check", e.message);
    return fail(e.message, 503);
  }
}
