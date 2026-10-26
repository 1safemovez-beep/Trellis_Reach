import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Server-only helpers. The service role key never reaches the browser.

let admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Server is missing Supabase settings.");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Confirms the caller is signed in AND on the team allowlist.
export async function requireTeam(req: Request): Promise<{ email: string } | Response> {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return fail("Please sign in.", 401);
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return fail("Your session expired. Please sign in again.", 401);
  const { data: member } = await db.from("team_members").select("email").eq("email", email).maybeSingle();
  if (!member) return fail("This account isn't on the Trellis Reach team yet.", 403);
  return { email };
}

// Simple per-instance rate limit. For heavy traffic, swap for Upstash or Vercel KV.
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, key: string, max: number, windowMs: number): boolean {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const list = (hits.get(id) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(id, list);
  return list.length > max;
}

export function clean(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
