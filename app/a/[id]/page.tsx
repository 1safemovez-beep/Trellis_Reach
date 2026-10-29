import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/server";
import { videoStatus } from "@/lib/heygen";
import { adCopy } from "@/lib/adcopy";
import { CALLER } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Public page for a shared ad or video. Only content the team marked shareable ("Live") shows.
async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin().from("content").select("id, title, body, business, status, video_id, video_status")
    .eq("id", id).eq("status", "Live").maybeSingle();
  if (!data) return null;
  let video: { url: string | null; poster: string | null } = { url: null, poster: null };
  if (data.video_id && data.video_status === "completed") {
    try { const s = await videoStatus(data.video_id); video = { url: s.url, poster: s.thumbnail }; } catch {}
  }
  return { ...data, text: adCopy(data.body), video };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await load(params.id);
  if (!c) return { title: "Hivecast" };
  const description = c.text.slice(0, 180);
  return {
    title: `${c.title} · ${c.business || CALLER.company}`,
    description,
    openGraph: { title: c.title, description, type: c.video.url ? "video.other" : "website", ...(c.video.poster ? { images: [c.video.poster] } : {}) },
    twitter: { card: c.video.poster ? "summary_large_image" : "summary", title: c.title, description },
  };
}

export default async function SharedAd({ params }: { params: { id: string } }) {
  const c = await load(params.id);
  if (!c) return (
    <main className="wrap" style={{ paddingBlock: 40 }}><div className="panel"><h2>This post isn't available</h2><p className="note"><a href="/">Go to Hivecast</a></p></div></main>
  );
  return (
    <main className="wrap" style={{ paddingBlock: "28px 60px" }}>
      <div className="panel" style={{ maxWidth: 560, margin: "0 auto", display: "grid", gap: 12 }}>
        <span className="eyebrow">{c.business || CALLER.company} <span className="pill honey">✦ This service uses AI</span></span>
        <h2>{c.title}</h2>
        {c.video.url && <><video className="hive-video" src={c.video.url} poster={c.video.poster || undefined} controls playsInline /><span className="ai-tag">Made with AI</span></>}
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{c.text.slice(0, 900)}</p>
        <a className="btn honey" href={`/?c=${c.id}`} style={{ justifySelf: "start" }}>See how it works →</a>
        <p className="note" style={{ margin: 0 }}>{CALLER.company} · <a href="/optout">Opt out</a></p>
      </div>
    </main>
  );
}
