"use client";
import { useEffect, useState } from "react";
import { api, supabase } from "@/lib/supabaseClient";
import type { TeamData } from "@/lib/useTeamData";
import { copyText, Empty, Head, useToast } from "./ui";
import { AdPreview, adCopy } from "./ad";

const NETS = [
  { id: "facebook", label: "Facebook", url: (l: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(l)}` },
  { id: "linkedin", label: "LinkedIn", url: (l: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(l)}` },
  { id: "x", label: "X", url: (l: string, t: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t.replace("[LINK]", "").trim())}&url=${encodeURIComponent(l)}` },
  { id: "whatsapp", label: "WhatsApp", url: (l: string, t: string) => `https://wa.me/?text=${encodeURIComponent(t.includes("[LINK]") ? t.replace("[LINK]", l) : `${t} ${l}`)}` },
  { id: "email", label: "Email", url: (l: string, t: string) => `mailto:?subject=${encodeURIComponent("Thought you'd like this")}&body=${encodeURIComponent(t.includes("[LINK]") ? t.replace("[LINK]", l) : `${t}\n\n${l}`)}` },
] as const;

// Share tab: turn any saved ad or video into a public link and post it everywhere.
export function Share({ d }: { d: TeamData }) {
  const toast = useToast();
  const [id, setId] = useState("");
  const [caps, setCaps] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  useEffect(() => { if (!id && d.content[0]) setId(d.content[0].id); }, [d.content, id]);
  const c = d.content.find((x) => x.id === id);
  const link = c && typeof window !== "undefined" ? `${window.location.origin}/a/${c.id}` : "";
  const isPublic = c?.status === "Live";

  useEffect(() => {
    setCaps({}); setVideo(null);
    if (c?.video_id && c.video_status === "completed") api("/api/video/status", { videoId: c.video_id }).then((s) => setVideo(s.url)).catch(() => {});
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function makePublic() {
    const { error } = await supabase().from("content").update({ status: "Live" }).eq("id", id);
    toast(error ? `Couldn't update: ${error.message}` : "Share link is on");
  }
  async function writeCaptions() {
    if (!c) return;
    setBusy(true);
    try { setCaps(await api("/api/agents/captions", { title: c.title, body: c.body, business: c.business, hasVideo: Boolean(c.video_id) })); }
    catch (x: any) { toast(x.message); } finally { setBusy(false); }
  }
  const text = (net: string) => (caps[net] || (c ? `${c.title}\n\n[LINK]` : ""));
  async function open(net: (typeof NETS)[number]) {
    const t = text(net.id);
    try { await navigator.clipboard.writeText(t.replace("[LINK]", link)); toast("Caption copied. Paste it into the post."); } catch {}
    window.open(net.url(link, t), "_blank", "noopener");
  }
  async function nativeShare() {
    if (!c) return;
    const t = text("facebook").replace("[LINK]", "").trim();
    if (navigator.share) { try { await navigator.share({ title: c.title, text: t, url: link }); } catch {} }
    else copyText(link, toast);
  }

  return (
    <section className="view">
      <Head eyebrow="Share" title="Post your ads and videos everywhere" lead="Pick an ad or video, turn on its share link, and post it with a caption written for each network. Every view leads back into Hivecast." />
      {!d.content.length ? <Empty>Make an ad or video in Create first. It shows up here to share.</Empty> : (
        <div className="grid2">
          <div className="panel form">
            <label>What to share<select value={id} onChange={(e) => setId(e.target.value)}>
              {d.content.map((x) => <option key={x.id} value={x.id}>{x.title}{x.video_id ? " 🎬" : ""}</option>)}
            </select></label>
            {c && <AdPreview business={c.business || "Trellis Reach"} title={c.title} text={adCopy(c.body)} videoUrl={video} />}
          </div>
          <div className="panel form">
            {!isPublic ? (<>
              <h3 style={{ margin: 0 }}>1. Turn on the share link</h3>
              <p className="note" style={{ margin: 0 }}>This makes a public page for this ad only. Everything else stays private.</p>
              <button className="btn honey" type="button" onClick={makePublic} style={{ justifySelf: "start" }}>Turn on share link</button>
            </>) : (<>
              <h3 style={{ margin: 0 }}>Share link</h3>
              <div className="row"><input readOnly value={link} style={{ flex: 1, minWidth: 0 }} /><button className="btn small" type="button" onClick={() => copyText(link, toast)}>Copy</button><a className="btn small" href={link} target="_blank" rel="noreferrer">Open ↗</a></div>
              <h3 style={{ margin: "8px 0 0" }}>2. Captions</h3>
              <button className="btn primary" type="button" onClick={writeCaptions} disabled={busy} style={{ justifySelf: "start" }}>{busy ? "Writing…" : "✨ Write captions with AI"}</button>
              {Object.keys(caps).length > 0 && ["facebook", "instagram", "linkedin", "x", "tiktok"].map((k) => (
                <label key={k} style={{ textTransform: "capitalize" }}>{k === "x" ? "X" : k}<textarea value={caps[k] || ""} onChange={(e) => setCaps((v) => ({ ...v, [k]: e.target.value }))} style={{ minHeight: 80 }} /></label>
              ))}
              <h3 style={{ margin: "8px 0 0" }}>3. Post it</h3>
              <div className="row">
                <button className="btn honey" type="button" onClick={nativeShare}>📲 Share…</button>
                {NETS.map((n) => <button key={n.id} className="btn small" type="button" onClick={() => open(n)}>{n.label}</button>)}
              </div>
              <div className="row">
                <button className="btn small" type="button" onClick={() => copyText(text("instagram").replace("[LINK]", link), toast)}>Copy Instagram caption</button>
                <button className="btn small" type="button" onClick={() => copyText(text("tiktok").replace("[LINK]", link), toast)}>Copy TikTok caption</button>
                {video && <a className="btn small" href={video} target="_blank" rel="noreferrer" download>Download video</a>}
              </div>
              <p className="note" style={{ margin: 0 }}>Instagram and TikTok don't accept shared links from websites: download the video, copy the caption, and post in their app. On a phone, "Share…" opens your phone's share menu. Automatic posting switches on with the Social posting plug-in.</p>
              <button className="btn small" type="button" onClick={async () => { const { error } = await supabase().from("content").update({ status: "Draft" }).eq("id", id); toast(error ? error.message : "Share link turned off"); }} style={{ justifySelf: "start" }}>Turn off share link</button>
            </>)}
          </div>
        </div>
      )}
    </section>
  );
}
