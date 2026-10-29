import { NextResponse } from "next/server";
import { videoStatus } from "@/lib/heygen";
import { PATHS } from "@/lib/constants";
import { fail, rateLimited, supabaseAdmin } from "@/lib/server";

export const dynamic = "force-dynamic";

// Public: the finished video chosen for a Hivecast path, with a fresh link.
export async function GET(req: Request) {
  if (rateLimited(req, "path-video", 30, 60_000)) return fail("Too many tries.", 429);
  const path = new URL(req.url).searchParams.get("path") || "";
  if (!PATHS.some((p) => p.id === path)) return NextResponse.json({ url: null });
  const { data } = await supabaseAdmin().from("content").select("video_id")
    .eq("hivecast_path", path).eq("video_status", "completed").not("video_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.video_id) return NextResponse.json({ url: null });
  try {
    const s = await videoStatus(data.video_id);
    return NextResponse.json({ url: s.status === "completed" ? s.url : null, poster: s.thumbnail });
  } catch {
    return NextResponse.json({ url: null });
  }
}
