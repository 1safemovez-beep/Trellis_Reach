// What the AI knows about Alicia Spears' businesses and apps. Edited by admins in
// Settings → "What the AI knows" and shared by every agent, so they all describe things the same way.
import { supabaseAdmin } from "./server";

let cache: { at: number; rows: { name: string; about: string }[] } | null = null;

async function rows() {
  if (cache && Date.now() - cache.at < 60_000) return cache.rows;
  try {
    const { data } = await supabaseAdmin().from("app_knowledge").select("name, about").order("sort");
    cache = { at: Date.now(), rows: (data || []).filter((r) => r.about?.trim()) };
  } catch { cache = { at: Date.now(), rows: [] }; }
  return cache.rows;
}

// Returns a block for an AI prompt. The focus business (if any) comes first and in full.
export async function knowledge(focus?: string | null): Promise<string> {
  const list = await rows();
  if (!list.length) return "";
  const f = (focus || "").toLowerCase().trim();
  const main = f ? list.find((r) => r.name.toLowerCase() === f || f.includes(r.name.toLowerCase())) : undefined;
  const others = list.filter((r) => r !== main);
  return `ABOUT OUR BUSINESSES (facts from the owner, Alicia Spears of QVTrellis). Use these facts, never contradict them, and don't invent details beyond them:
${main ? `>> ${main.name} (this is the one we're working on): ${main.about}\n` : ""}${others.map((r) => `- ${r.name}: ${r.about}`).join("\n")}`;
}
