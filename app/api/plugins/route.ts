import { NextResponse } from "next/server";
import { PLUGINS } from "@/lib/constants";
import { requireTeam } from "@/lib/server";

// Reports which plug-ins have their keys set on the server, without revealing the keys.
export async function POST(req: Request) {
  const who = await requireTeam(req);
  if (who instanceof Response) return who;
  return NextResponse.json({ plugins: PLUGINS.map((p) => ({ ...p, connected: [p.env, ...(p.alt || [])].some((k) => Boolean(process.env[k])) })) });
}
