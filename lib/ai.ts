// Server-only wrapper around the Anthropic Messages API.

const API = "https://api.anthropic.com/v1/messages";

type Msg = { role: "user" | "assistant"; content: string };

export async function ask(opts: { system: string; messages: Msg[]; quick?: boolean; maxTokens?: number }): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("The AI isn't configured yet. Add ANTHROPIC_API_KEY on the server.");
  const model = opts.quick
    ? process.env.ANTHROPIC_MODEL_QUICK || "claude-haiku-5-5"
    : process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const res = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: opts.maxTokens || 1500, system: opts.system, messages: opts.messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Anthropic error", res.status, text.slice(0, 300));
    // Plain-language reasons so the owner can fix setup without reading logs.
    if (res.status === 401) throw new Error("The AI key is wrong (401). Check ANTHROPIC_API_KEY in Vercel, then redeploy.");
    if (res.status === 403) throw new Error("This AI key isn't allowed to do that (403). Make a new key in the Anthropic console.");
    if (res.status === 404 || /model/i.test(text) && res.status === 400) throw new Error(`The AI model name "${model}" isn't available (${res.status}). Set ANTHROPIC_MODEL and ANTHROPIC_MODEL_QUICK in Vercel, then redeploy.`);
    if (/credit balance|billing/i.test(text)) throw new Error("The Anthropic account has no credits. Add credits in the Anthropic console under Billing.");
    if (res.status === 429) throw new Error("The AI is busy. Try again in a moment.");
    if (res.status === 529 || res.status >= 500) throw new Error("The AI service is overloaded right now. Try again in a minute.");
    throw new Error(`The AI couldn't answer (${res.status}).`);
  }
  const json = await res.json();
  return (json.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

// Asks for JSON and parses the first object in the reply.
export async function askJSON<T = any>(opts: Parameters<typeof ask>[0]): Promise<T> {
  const text = await ask({ ...opts, system: opts.system + "\n\nReply with only a JSON object. No prose, no code fences." });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("The AI reply wasn't in the expected format. Try again.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

// Rules every piece of marketing must follow. Kept in one place so all agents share them.
export const COMPLIANCE_RULES = `Never invent results, numbers, reviews, testimonials or guarantees; use only proof the business supplied, otherwise an honest founder story or free trial.
Never pressure or use false urgency. Emails need an easy unsubscribe line. SMS must name the sender and end with "Reply STOP to opt out".
AI phone scripts open by saying it is an AI assistant, ask if now is a good time, and offer a human at any point.
AI-generated video carries a short "Made with AI" disclosure. Texts and calls only go to leads who consented.`;
