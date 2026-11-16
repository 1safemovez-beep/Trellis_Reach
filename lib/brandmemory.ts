// What we remember about one client business, as a block for AI prompts.
// Written by the team (voice, do, don't) and by the client's own approvals and feedback.
import { supabaseAdmin } from "./server";

const LABEL: Record<string, string> = {
  voice: "How they sound", do: "Always do", dont: "Never do",
  approved_ad: "Ads the client approved (match this style)", client_feedback: "What the client asked to change before (don't repeat it)",
};

export async function brandMemory(business?: string | null): Promise<string> {
  const name = (business || "").trim();
  if (!name) return "";
  try {
    const { data } = await supabaseAdmin().from("brand_memory").select("kind, note").ilike("business_name", name)
      .order("created_at", { ascending: false }).limit(40);
    if (!data?.length) return "";
    const groups: Record<string, string[]> = {};
    for (const r of data) (groups[r.kind] = groups[r.kind] || []).push(String(r.note).slice(0, 400));
    const lines = Object.keys(LABEL).filter((k) => groups[k]?.length)
      .map((k) => `${LABEL[k]}:\n${groups[k].slice(0, k === "approved_ad" ? 3 : 8).map((n) => `- ${n}`).join("\n")}`);
    return lines.length ? `BRAND MEMORY for ${name} (from the team and the client; follow it, never contradict it):\n${lines.join("\n")}` : "";
  } catch { return ""; } // memory table not installed yet: carry on without it
}
