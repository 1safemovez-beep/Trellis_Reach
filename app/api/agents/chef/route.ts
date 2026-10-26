import { NextResponse } from "next/server";
import { askJSON } from "@/lib/ai";
import { BUSINESSES, PROFILE_SLOTS } from "@/lib/constants";
import { fail, requireTeam } from "@/lib/server";

// Agent 1: Marketing Chef. Interviews the owner one question at a time and fills the profile.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  const b = await req.json().catch(() => null);
  const history = Array.isArray(b?.history) ? b.history.slice(-30) : [];
  const fields = typeof b?.fields === "object" && b.fields ? b.fields : {};
  if (!history.length) return fail("Say something to the Chef first.");
  const transcript = history
    .map((m: any) => `${m.role === "ai" ? "Chef" : "Owner"}: ${String(m.text || "").slice(0, 1500)}`)
    .join("\n");
  try {
    const r = await askJSON<{ reply: string; fields: Record<string, string>; done: boolean }>({
      quick: true,
      system: `You are the Marketing Chef inside Trellis Reach, a voice-first marketing app. You interview a business owner to fill a profile.
Be warm, plain-spoken and brief. Ask exactly ONE question per reply. Never push or hype.
Fields: ${PROFILE_SLOTS.map(([k, l]) => `${k} (${l})`).join(", ")}. For "app" choose from: ${BUSINESSES.join(", ")}.
Extract values the owner gave, cleaned up but faithful. Never invent facts or results. If they have no proof yet, set proof to "None yet - use founder story or free trial".
If an answer is vague, ask a gentle follow-up. When all fields are filled, give a one-line summary and ask them to tap Save business.
JSON shape: {"reply": string, "fields": {only fields learned or corrected in the owner's last message}, "done": boolean}`,
      messages: [{ role: "user", content: `Current fields: ${JSON.stringify(fields)}\n\nConversation:\n${transcript}` }],
    });
    const allowed = new Set(PROFILE_SLOTS.map(([k]) => k));
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.fields || {})) if (allowed.has(k)) out[k] = String(v).slice(0, 500);
    return NextResponse.json({ reply: r.reply || "Got it. What's next?", fields: out, done: Boolean(r.done) });
  } catch (e: any) {
    return fail(e.message || "The Chef couldn't answer.", 503);
  }
}
