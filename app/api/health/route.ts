import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Setup checker. Reports only yes/no answers, never keys or emails, so it is safe to leave public.
export async function GET() {
  const has = (k: string) => Boolean(process.env[k] && !String(process.env[k]).startsWith("your-"));
  const checks: Record<string, boolean | string> = {
    supabaseUrl: has("NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceKey: has("SUPABASE_SERVICE_ROLE_KEY"),
    anthropicKey: has("ANTHROPIC_API_KEY"),
    heygenVideoKey: has("HEYGEN_API_KEY") || has("VIDEO_API_KEY"),
    databaseReachable: false,
    schemaInstalled: false,
    teamHasOwner: false,
  };
  if (checks.supabaseUrl && checks.supabaseServiceKey) {
    try {
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const { count, error } = await db.from("team_members").select("email", { count: "exact", head: true }).eq("role", "owner");
      checks.databaseReachable = true;
      if (error) checks.schemaInstalled = error.code === "42P01" ? false : `error: ${error.code || "unknown"}`;
      else { checks.schemaInstalled = true; checks.teamHasOwner = (count || 0) > 0; }
    } catch {
      checks.databaseReachable = false;
    }
  }
  const ok = Object.entries(checks).filter(([k]) => k !== "heygenVideoKey").every(([, v]) => v === true);
  return NextResponse.json({ ok, checks }, { headers: { "Cache-Control": "no-store" } });
}
