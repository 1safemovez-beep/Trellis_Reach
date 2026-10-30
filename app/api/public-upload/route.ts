import { NextResponse } from "next/server";
import { fail, rateLimited, supabaseAdmin } from "@/lib/server";

export const maxDuration = 60;

// Public upload for sign-up pages (sample work). Images up to 10 MB, videos up to 50 MB.
export async function POST(req: Request) {
  if (rateLimited(req, "public-upload", 5, 10 * 60_000)) return fail("Too many uploads. Please wait a few minutes.", 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return fail("Choose a file first.");
  if (form?.get("ok") !== "yes") return fail("Please confirm it's your own work.");
  const isImg = /^image\/(png|jpeg|webp|gif)$/.test(file.type), isVid = /^video\/(mp4|quicktime|webm)$/.test(file.type);
  if (!isImg && !isVid) return fail("Use a photo (JPG, PNG) or a video (MP4, MOV).");
  if (file.size > (isImg ? 10 : 50) * 1024 * 1024) return fail(isImg ? "Photos must be under 10 MB." : "Videos must be under 50 MB.");
  const ext = file.type.split("/")[1].replace("quicktime", "mov").replace("jpeg", "jpg");
  const path = `signup/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const db = supabaseAdmin();
  const { error } = await db.storage.from("creator-uploads").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return fail("Upload failed. Please try again.", 500);
  return NextResponse.json({ url: db.storage.from("creator-uploads").getPublicUrl(path).data.publicUrl });
}
