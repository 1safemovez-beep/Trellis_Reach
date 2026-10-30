// Server-only HeyGen helpers. The key stays on the server and never reaches the browser.
const BASE = "https://api.heygen.com";

export function heygenKey(): string {
  const key = process.env.HEYGEN_API_KEY || process.env.VIDEO_API_KEY;
  if (!key) throw new Error("The video plug-in isn't set up. Add HEYGEN_API_KEY in Vercel → Settings → Environment Variables, then redeploy.");
  return key;
}

export async function heygen(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(BASE + path, {
    method: init.method || "GET",
    headers: { "X-Api-Key": heygenKey(), Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || (json.error && json.error !== null && typeof json.error === "object" && json.error.message)) {
    const msg = json?.error?.message || json?.message || json?.msg || "";
    console.error("HeyGen error", res.status, String(msg).slice(0, 300));
    await logError(`heygen ${path.split("?")[0]}`, `${res.status} ${typeof json === "object" ? JSON.stringify(json).slice(0, 700) : ""}`);
    if (res.status === 401) throw new Error("HeyGen says the key is wrong (401). Check HEYGEN_API_KEY in Vercel, then redeploy.");
    if (res.status === 402 || /credit|quota|insufficient/i.test(msg)) throw new Error("HeyGen is out of credits for API videos. Add API credits in your HeyGen account.");
    if (res.status === 429) throw new Error("HeyGen is busy. Try again in a minute.");
    throw new Error(`HeyGen couldn't do that (${res.status})${msg ? `: ${msg}` : ""}.`);
  }
  return json;
}

export type VideoStatus = { status: string; url: string | null; thumbnail: string | null; error: string | null; duration: number | null };

// Each call returns a fresh video link (HeyGen links expire after 7 days).
export async function videoStatus(videoId: string): Promise<VideoStatus> {
  const j = await heygen(`/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`);
  const d = j.data || {};
  return {
    status: d.status || "unknown",
    url: d.video_url || null,
    thumbnail: d.thumbnail_url || null,
    error: d.error ? d.error.detail || d.error.message || "Video failed" : null,
    duration: d.duration ?? null,
  };
}

// Records why a video step failed (never the key), so the owner and Claude can see it.
export async function logError(area: string, message: string) {
  try {
    const { supabaseAdmin } = await import("./server");
    await supabaseAdmin().from("app_errors").insert({ area, message: String(message).slice(0, 1000) });
  } catch {}
}
