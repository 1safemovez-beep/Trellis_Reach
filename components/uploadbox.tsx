"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "./ui";
import { EMPTY_RELEASE, ReleaseBox, releaseReady, type ReleaseInfo } from "./release";

// Upload a photo or video to storage, with "I own it" and the media release.
export function UploadBox({ business, onUploaded, label = "Upload a photo or video" }: {
  business: string; label?: string;
  onUploaded: (u: { url: string; isVideo: boolean; name: string; release: ReleaseInfo }) => void | Promise<void>;
}) {
  const toast = useToast();
  const [ok, setOk] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [release, setRelease] = useState<ReleaseInfo>(EMPTY_RELEASE);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isVid = Boolean(file?.type.startsWith("video/"));

  async function finish() {
    if (!file) return setErr("Choose a file first.");
    if (!ok) return setErr("Tick the box: you own this or have permission.");
    if (!releaseReady(release)) return setErr("Finish the release: who's shown, and their name (and your signature if it's you).");
    setBusy(true); setErr("");
    try {
      const path = `${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase().storage.from("creator-uploads").upload(path, file, { contentType: file.type });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      const url = supabase().storage.from("creator-uploads").getPublicUrl(path).data.publicUrl;
      await onUploaded({ url, isVideo: isVid, name: file.name, release });
      setFile(null); setPreview(""); setRelease(EMPTY_RELEASE); setOk(false);
    } catch (x: any) { setErr(x.message); toast(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="drop" style={{ gridTemplateColumns: "1fr" }}>
      <div className="row" style={{ alignItems: "center" }}>
        {preview ? (isVid ? <video src={preview} controls playsInline style={{ width: 110, height: 110, borderRadius: 14, objectFit: "cover" }} /> : <img src={preview} alt="" style={{ width: 110, height: 110, borderRadius: 14, objectFit: "cover" }} />) : <span className="drop-ph" aria-hidden="true">⬆</span>}
        <div className="form" style={{ gap: 6, flex: 1, minWidth: 200 }}>
          <b>{label}</b>
          <label className="btn honey small" style={{ cursor: "pointer", justifySelf: "start" }}>{file ? "Change file" : "Choose file"}
            <input type="file" accept="image/*,video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setPreview(URL.createObjectURL(f)); } e.target.value = ""; }} />
          </label>
        </div>
      </div>
      {file && (<>
        <label className="checkline"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>I own this or have permission to use it.</span></label>
        <ReleaseBox value={release} onChange={setRelease} defaultBusiness={business} />
        <div className="row"><button className="btn primary" type="button" onClick={finish} disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>{err && <span className="err">{err}</span>}</div>
      </>)}
    </div>
  );
}
