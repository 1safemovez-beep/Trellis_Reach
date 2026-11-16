"use client";
import { useEffect } from "react";

// Counts one view per visitor per browser session on the public shared-ad page.
export function TrackView({ id }: { id: string }) {
  useEffect(() => {
    try { if (sessionStorage.getItem("tr-view-" + id)) return; sessionStorage.setItem("tr-view-" + id, "1"); } catch {}
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: id, kind: "view" }) }).catch(() => {});
  }, [id]);
  return null;
}

// "See how it works" link on the shared ad page. Counts the click, then goes on to Hivecast.
export function TrackLink({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <a className="btn honey" href={`/?c=${id}`} style={{ justifySelf: "start" }}
      onClick={() => { try { navigator.sendBeacon("/api/track", new Blob([JSON.stringify({ contentId: id, kind: "click" })], { type: "application/json" })); } catch {} }}>
      {children}
    </a>
  );
}
