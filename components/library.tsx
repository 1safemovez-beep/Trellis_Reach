"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { TeamData } from "@/lib/useTeamData";
import { Empty, Head, useToast, when } from "./ui";
import { AdPreview, adCopy, isAdFormat } from "./ad";
import { PlaySaved } from "./video";
import { UploadBox } from "./uploadbox";
import { saveRelease, SignLink } from "./release";
import { BUSINESSES } from "@/lib/constants";

// Library: every ad and video you've made, newest first, with videos ready to play.
export function Library({ d, go }: { d: TeamData; go: (t: string) => void }) {
  const toast = useToast();
  const [show, setShow] = useState<"all" | "videos" | "ads" | "examples">("all");
  const [adding, setAdding] = useState(false);
  const [biz, setBiz] = useState(BUSINESSES[0]);
  const [signId, setSignId] = useState("");
  async function added(u: { url: string; isVideo: boolean; name: string; release: any }) {
    const { data: me } = await supabase().auth.getUser();
    const { data, error } = await supabase().from("content").insert({
      title: u.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80) || "Upload", body: "Uploaded file", type: u.isVideo ? "Uploaded video" : "Uploaded image",
      business: biz, status: "Draft", media_url: u.url, created_by: me.user?.id, video_mode: "Upload",
    }).select("id").single();
    if (error) throw new Error(`Couldn't save: ${error.message}`);
    const r = await saveRelease(u.release, { mediaUrl: u.url, contentId: data.id });
    if (r?.status === "Pending") setSignId(r.id);
    toast("Added to your Library 🐝"); setAdding(false);
  }
  const items = d.content.filter((c) =>
    show === "videos" ? Boolean(c.video_id) : show === "ads" ? !c.video_id && isAdFormat(c.type) : show === "examples" ? (c as any).featured : true);
  async function feature(id: string, on: boolean) {
    const { error } = await supabase().from("content").update({ featured: on }).eq("id", id);
    toast(error ? `Couldn't update: ${error.message}` : on ? "Now showing as an example on the creator page" : "Removed from examples");
  }
  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete "${title}" from your library? This can't be undone.`)) return;
    const { error } = await supabase().from("content").delete().eq("id", id);
    toast(error ? `Couldn't delete: ${error.message}` : "Deleted");
  }
  return (
    <section className="view">
      <Head eyebrow="Library" title="Your ads and videos" />
      <div className="row">
        {(["all", "videos", "ads", "examples"] as const).map((k) => (
          <button key={k} type="button" className={"btn small" + (show === k ? " primary" : "")} onClick={() => setShow(k)}>
            {k === "all" ? "All" : k === "videos" ? "🎬 Videos" : k === "ads" ? "📣 Ads" : "⭐ Examples"}
          </button>
        ))}
        <div className="row" style={{ marginLeft: "auto" }}>
          <button type="button" className="btn small" onClick={() => setAdding((v) => !v)}>⬆ Upload</button>
          <button type="button" className="btn small honey" onClick={() => go("create")}>+ Make new</button>
        </div>
      </div>
      {adding && (
        <div className="panel form">
          <label>For<select value={biz} onChange={(e) => setBiz(e.target.value)}>{BUSINESSES.map((b) => <option key={b}>{b}</option>)}</select></label>
          <UploadBox business={biz} onUploaded={added} label="Add a photo or video to your Library" />
        </div>
      )}
      {signId && <SignLink id={signId} />}
      {!items.length ? <Empty>Nothing here yet. Tap “Make new” to create your first one.</Empty> : (
        <div className="lib">
          {items.map((c, i) => (
            <div key={c.id} className={"lib-card" + (i === 0 && show === "all" ? " lib-new" : "")}>
              {c.video_id ? <PlaySaved videoId={c.video_id} status={c.video_status} />
                : c.video_mode === "AI Video" ? <div className="empty" style={{ margin: 12 }}>{c.video_status === "failed" ? "⚠️ The video didn't go through. Open Create and try Make the video again." : "No video made yet. Open Create → AI Video → Make the video."}</div>
                : c.media_url ? (/\.(mp4|mov|webm)(\?|$)/i.test(c.media_url) ? <video className="hive-video" src={c.media_url} controls playsInline /> : <img src={c.media_url} alt={c.title} style={{ width: "100%", display: "block" }} />)
                : c.video_id ? <PlaySaved videoId={c.video_id} status={c.video_status} /> : isAdFormat(c.type) ? <AdPreview business={c.business || "Trellis Reach"} title={c.title} text={adCopy(c.body)} /> : null}
              <div className="lib-body">
                <b>{i === 0 && show === "all" ? "🆕 " : ""}{c.title}</b>
                <span className="note">{c.type} · {c.business} · {when(c.created_at)}</span>
                {(c as any).release_status && <span className={"pill " + ((c as any).release_status === "Signed" ? "" : "bad")} style={{ justifySelf: "start" }}>{(c as any).release_status === "Signed" ? "✍️ Release signed" : "⏳ Waiting for signature"}</span>}
                <details><summary className="note" style={{ cursor: "pointer" }}>Script</summary><div className="out" style={{ marginTop: 6 }}>{c.body}</div></details>
                <div className="row">
                  <button className="btn small primary" type="button" onClick={() => go("share")}>Share</button>
                  <button className={"btn small" + ((c as any).featured ? " honey" : "")} type="button" onClick={() => feature(c.id, !(c as any).featured)}>{(c as any).featured ? "⭐ Example" : "☆ Use as example"}</button>
                  <button className="btn small danger-outline" type="button" onClick={() => remove(c.id, c.title)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
