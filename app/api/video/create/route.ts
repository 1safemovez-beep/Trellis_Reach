import { NextResponse } from "next/server";
import { heygen } from "@/lib/heygen";
import { PATHS } from "@/lib/constants";
import { clean, fail, requireTeam, supabaseAdmin } from "@/lib/server";

// Starts a HeyGen avatar video that reads the script word for word.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const text = clean(b?.text, 1500);
  const avatarId = clean(b?.avatarId, 200);
  const photoId = clean(b?.photoId, 200); // their own face, from /api/video/photo
  const voiceId = clean(b?.voiceId, 200);
  const contentId = clean(b?.contentId, 64);
  const aspect = b?.aspect === "9:16" ? "9:16" : "16:9";
  const hivecastPath = PATHS.some((p) => p.id === b?.hivecastPath) ? b.hivecastPath : null;
  if (text.length < 5) return fail("Add the words the avatar should say.");
  if ((!avatarId && !photoId) || !voiceId) return fail("Pick an avatar (or add your photo) and a voice.");
  try {
    const r = await heygen("/v2/video/generate", {
      method: "POST",
      body: {
        video_inputs: [{
          character: photoId ? { type: "talking_photo", talking_photo_id: photoId } : { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
          voice: { type: "text", input_text: text, voice_id: voiceId },
        }],
        aspect_ratio: aspect,
      },
    });
    const videoId = r.data?.video_id;
    if (!videoId) return fail("HeyGen didn't return a video. Try again.", 502);
    if (/^[0-9a-f-]{36}$/i.test(contentId)) {
      await supabaseAdmin().from("content").update({ video_id: videoId, video_status: "processing", hivecast_path: hivecastPath }).eq("id", contentId);
    }
    return NextResponse.json({ videoId });
  } catch (e: any) {
    return fail(e.message, 503);
  }
}
