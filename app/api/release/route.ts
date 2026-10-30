import { NextResponse } from "next/server";
import { CALLER, RELEASE_TERMS } from "@/lib/constants";
import { clean, fail, rateLimited, requireTeam, supabaseAdmin } from "@/lib/server";

// GET ?id= : public, shows a pending release to the person who needs to sign it.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Release not found.", 404);
  const { data } = await supabaseAdmin().from("media_releases").select("id, person_name, business, products, status, media_url, signed_at").eq("id", id).maybeSingle();
  if (!data) return fail("Release not found.", 404);
  return NextResponse.json({ ...data, terms: RELEASE_TERMS(data.person_name, data.business || "", data.products || ""), company: CALLER.company });
}

// POST: team creates a release (self-signed now, or pending for someone else),
// or anyone signs a pending release with { id, signature, agree }.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return fail("Something went wrong. Please try again.");
  const db = supabaseAdmin();

  if (b.action === "sign") {
    if (rateLimited(req, "release-sign", 10, 60_000)) return fail("Too many tries. Please wait a minute.", 429);
    const id = clean(b.id, 64);
    const signature = clean(b.signature, 120);
    if (!b.agree) return fail("Please tick the box to agree.");
    if (signature.length < 3) return fail("Type your full name to sign.");
    const { data } = await db.from("media_releases").select("person_name, status, content_id").eq("id", id).maybeSingle();
    if (!data) return fail("Release not found.", 404);
    if (data.status === "Signed") return NextResponse.json({ ok: true });
    await db.from("media_releases").update({ status: "Signed", signature, signed_at: new Date().toISOString() }).eq("id", id);
    if (data.content_id) await refreshContent(data.content_id);
    return NextResponse.json({ ok: true });
  }

  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const person = clean(b.personName, 120);
  if (!person) return fail("Enter the name of the person shown.");
  const isSelf = Boolean(b.isSelf);
  if (isSelf && (!b.agree || clean(b.signature, 120).length < 3)) return fail("Tick agree and type your full name to sign.");
  const row = {
    media_url: clean(b.mediaUrl, 500) || null, person_name: person, person_email: clean(b.personEmail, 200).toLowerCase() || null,
    business: clean(b.business, 160) || null, products: clean(b.products, 300) || null, is_self: isSelf,
    status: isSelf ? "Signed" : "Pending", signature: isSelf ? clean(b.signature, 120) : null, signed_at: isSelf ? new Date().toISOString() : null,
    content_id: /^[0-9a-f-]{36}$/i.test(b.contentId || "") ? b.contentId : null, entry_id: /^[0-9a-f-]{36}$/i.test(b.entryId || "") ? b.entryId : null,
  };
  const { data, error } = await db.from("media_releases").insert(row).select("id").single();
  if (error) return fail("Couldn't save the release.", 500);
  if (row.content_id) await refreshContent(row.content_id);
  return NextResponse.json({ id: data.id, status: row.status });
}

// Keeps a quick "all signed / waiting" flag on the ad, so the team sees it at a glance.
async function refreshContent(contentId: string) {
  const db = supabaseAdmin();
  const { data } = await db.from("media_releases").select("status").eq("content_id", contentId);
  const s = !data?.length ? null : data.every((r) => r.status === "Signed") ? "Signed" : "Waiting";
  await db.from("content").update({ release_status: s }).eq("id", contentId);
}
