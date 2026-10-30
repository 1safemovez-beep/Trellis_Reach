import { NextResponse } from "next/server";
import { heygenKey, logError } from "@/lib/heygen";
import { fail, requireTeam } from "@/lib/server";

export const maxDuration = 60;

// Uploads someone's photo to HeyGen so the AI video can use their face (a "talking photo").
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob)) return fail("Choose a photo first.");
  if (form?.get("consent") !== "yes") return fail("Confirm it's you, or you have their written permission.");
  if (!/^image\/(jpeg|png)$/.test(file.type)) return fail("Use a JPG or PNG photo.");
  if (file.size > 10 * 1024 * 1024) return fail("That photo is over 10 MB. Use a smaller one.");
  try {
    const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
      method: "POST", headers: { "x-api-key": heygenKey(), "Content-Type": file.type }, body: Buffer.from(await file.arrayBuffer()),
    });
    const j: any = await res.json().catch(() => ({}));
    const id = j?.data?.talking_photo_id;
    if (!res.ok || !id) {
      const msg = j?.message || j?.error?.message || "";
      await logError("video photo", `${res.status} ${JSON.stringify(j).slice(0, 700)}`);
      if (res.status === 401) return fail("HeyGen says the key is wrong (401). Check HEYGEN_API_KEY in Vercel, then redeploy.", 503);
      return fail(`HeyGen couldn't use that photo${msg ? `: ${msg}` : ""}. Use a clear photo with one face, looking at the camera.`, 503);
    }
    return NextResponse.json({ photoId: id });
  } catch (e: any) {
    await logError("video photo", e.message);
    return fail(e.message || "Couldn't upload the photo.", 503);
  }
}
