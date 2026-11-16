import { NextResponse } from "next/server";
import { clean, rateLimited, supabaseAdmin } from "@/lib/server";

// Public. Counts a view of a shared ad, or a click through to Hivecast from it.
// Only ads marked shareable ("Live") are counted. Always answers ok so a visitor never sees an error.
export async function POST(req: Request) {
  if (rateLimited(req, "track", 30, 60_000)) return NextResponse.json({ ok: true });
  const b = await req.json().catch(() => null);
  const id = clean(b?.contentId, 64);
  const kind = b?.kind === "click" ? "click" : b?.kind === "view" ? "view" : "";
  if (!kind || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: true });
  try {
    const db = supabaseAdmin();
    const { data: ad } = await db.from("content").select("id").eq("id", id).eq("status", "Live").maybeSingle();
    if (ad) await db.from("ad_events").insert({ content_id: id, kind });
  } catch (e: any) { console.error("track", e?.message); }
  return NextResponse.json({ ok: true });
}
