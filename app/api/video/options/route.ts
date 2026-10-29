import { NextResponse } from "next/server";
import { heygen } from "@/lib/heygen";
import { fail, requireTeam } from "@/lib/server";

// Lists the HeyGen avatars and voices this account can use.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  try {
    const [a, v] = await Promise.all([heygen("/v2/avatars"), heygen("/v1/voice.list")]);
    const avatars = (a.data?.avatars || []).map((x: any) => ({ id: x.avatar_id, name: x.avatar_name, gender: x.gender || "", preview: x.preview_image_url || null }));
    const voices = (v.data?.list || v.data?.voices || [])
      .map((x: any) => ({ id: x.voice_id, name: x.display_name || x.name, language: x.language || "", gender: x.gender || "", mine: Boolean(x.is_customer) }))
      .sort((x: any, y: any) => Number(y.mine) - Number(x.mine) || Number(/english/i.test(y.language)) - Number(/english/i.test(x.language)));
    return NextResponse.json({ avatars: avatars.slice(0, 400), voices: voices.slice(0, 400) });
  } catch (e: any) {
    return fail(e.message, 503);
  }
}
