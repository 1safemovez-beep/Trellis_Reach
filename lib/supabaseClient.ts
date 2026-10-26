"use client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Browser client. Uses the public anon key; row level security decides what each person can see.
export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return client;
}

// Calls one of our API routes with the signed-in person's token.
export async function api<T = any>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
