"use client";
// A live preview of the ad the way people will see it in their feed.
export function AdPreview({ business, title, text, cta = "Learn more", videoUrl }: { business: string; title: string; text: string; cta?: string; videoUrl?: string | null }) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const host = site.replace(/^https?:\/\//, "") || "qvtrellis.net";
  const short = text.length > 260 ? text.slice(0, 257).trimEnd() + "…" : text;
  return (
    <div className="ad">
      <div className="ad-head">
        <div className="logo ad-logo">{business.slice(0, 2).toUpperCase()}</div>
        <div><b>{business}</b><small>Sponsored</small></div>
      </div>
      <p className="ad-text">{short}</p>
      {videoUrl ? <video className="ad-media" src={videoUrl} controls playsInline /> : (
        <div className="ad-media ad-art">
          <img className="hive3d" src="/hive3d.svg" alt="" aria-hidden="true" />
          <span>{title}</span>
        </div>
      )}
      <a className="ad-cta" href={site || "/"} target="_blank" rel="noreferrer">
        <div><small>{host.toUpperCase()}</small><b>{title}</b></div>
        <span className="btn small">{cta}</span>
      </a>
    </div>
  );
}

// Pulls the readable ad copy out of a saved script.
export function adCopy(body: string) {
  const main = body.split(/\n\s*SHOT LIST/i)[0];
  return main.replace(/^\s*(\[[^\]]*\]|\([^)]*\)|[A-Z][A-Z /&-]{2,}:)\s*/gm, "").replace(/\n{2,}/g, "\n").trim();
}

export const isAdFormat = (type: string) => /ad|commercial|social post|video|outreach|invite/i.test(type || "");
