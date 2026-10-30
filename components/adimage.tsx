"use client";
import { useEffect, useRef, useState } from "react";

type G = { headline: string; sub: string; cta: string; badge?: string };

// Draws a premium designed ad image (navy, gold, honeycomb) the AI wrote, ready to download and post.
export function AdImage({ g, business, photo = "", onReady }: { g: G; business: string; photo?: string; onReady?: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState<"square" | "story">("square");
  const [url, setUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const W = 1080, H = shape === "square" ? 1080 : 1920;
      const c = ref.current; if (!c) return;
      c.width = W; c.height = H;
      const x = c.getContext("2d"); if (!x) return;
      try { await (document as any).fonts?.load?.("600 80px Fraunces"); } catch {}
      // Background: deep navy with the 3D hive glowing on the right
      const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#0B111E"); bg.addColorStop(1, "#1B2B4B");
      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      await new Promise<void>((res) => { const im = new Image(); im.onload = () => { x.globalAlpha = 0.55; x.drawImage(im, W * 0.15, 0, W * 1.3, H); x.globalAlpha = 1; res(); }; im.onerror = () => res(); im.src = "/hive3d.svg"; });
      // Their own photo or logo fills the right side, like a premium magazine ad.
      if (photo) await new Promise<void>((res) => {
        const im = new Image();
        im.onload = () => {
          const pw = W * 0.55, ph = H, px = W - pw;
          const s = Math.max(pw / im.width, ph / im.height), dw = im.width * s, dh = im.height * s;
          x.save(); x.beginPath(); x.rect(px, 0, pw, ph); x.clip();
          x.drawImage(im, px + (pw - dw) / 2, (ph - dh) / 2, dw, dh); x.restore(); res();
        };
        im.onerror = () => res(); im.src = photo;
      });
      const fade = x.createLinearGradient(0, 0, W, 0); fade.addColorStop(0, "rgba(11,17,30,.97)"); fade.addColorStop(0.42, "rgba(11,17,30,.88)"); fade.addColorStop(0.62, "rgba(11,17,30,.35)"); fade.addColorStop(1, "rgba(11,17,30,0)");
      x.fillStyle = fade; x.fillRect(0, 0, W, H);
      // Gold frame
      x.strokeStyle = "rgba(212,175,90,.8)"; x.lineWidth = 6; x.strokeRect(36, 36, W - 72, H - 72);
      const pad = 96; let y = shape === "square" ? 190 : 420;
      x.textBaseline = "top";
      if (g.badge) { x.font = "600 30px Figtree, sans-serif"; const bw = x.measureText(g.badge.toUpperCase()).width + 44; x.fillStyle = "#D4AF5A"; x.beginPath(); (x as any).roundRect?.(pad, y, bw, 56, 28); x.fill(); x.fillStyle = "#121A2B"; x.fillText(g.badge.toUpperCase(), pad + 22, y + 13); y += 100; }
      const wrap = (t: string, font: string, color: string, size: number, maxW: number, lh: number) => {
        x.font = font; x.fillStyle = color; const words = t.split(/\s+/); let line = "";
        for (const w of words) { const test = line ? line + " " + w : w; if (x.measureText(test).width > maxW && line) { x.fillText(line, pad, y); y += lh; line = w; } else line = test; }
        if (line) { x.fillText(line, pad, y); y += lh; } return size;
      };
      wrap(g.headline, "600 92px Fraunces, Georgia, serif", "#F3EEE2", 92, W - pad * 2 - 40, 104);
      y += 26; wrap(g.sub, "400 42px Figtree, sans-serif", "rgba(243,238,226,.88)", 42, W - pad * 2 - 80, 56);
      // CTA button
      const cy = H - (shape === "square" ? 230 : 420);
      x.font = "700 40px Figtree, sans-serif"; const cw = x.measureText(g.cta).width + 96;
      x.fillStyle = "#D4AF5A"; x.beginPath(); (x as any).roundRect?.(pad, cy, cw, 96, 48); x.fill();
      x.fillStyle = "#121A2B"; x.fillText(g.cta, pad + 48, cy + 27);
      x.font = "600 32px Figtree, sans-serif"; x.fillStyle = "rgba(243,238,226,.8)"; x.fillText(business, pad, H - 120);
      x.font = "500 24px Figtree, sans-serif"; x.fillStyle = "rgba(243,238,226,.55)"; x.fillText("Made with AI", W - pad - x.measureText("Made with AI").width, H - 112);
      if (cancelled) return;
      const d = c.toDataURL("image/png"); setUrl(d); onReady?.(d);
    })();
    return () => { cancelled = true; };
  }, [g.headline, g.sub, g.cta, g.badge, business, shape, photo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="form" style={{ gap: 8 }}>
      <canvas ref={ref} style={{ display: "none" }} />
      {url && <img src={url} alt={g.headline} style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line)" }} />}
      <div className="row">
        <button className={"btn small" + (shape === "square" ? " primary" : "")} type="button" onClick={() => setShape("square")}>Square post</button>
        <button className={"btn small" + (shape === "story" ? " primary" : "")} type="button" onClick={() => setShape("story")}>Story / Reel</button>
        {url && <a className="btn small honey" href={url} download={`${business.replace(/\W+/g, "-")}-ad-${shape}.png`}>⬇ Download image</a>}
      </div>
    </div>
  );
}
