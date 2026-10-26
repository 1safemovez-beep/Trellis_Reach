"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export type Lead = {
  id: string; name: string; email: string | null; phone: string | null; business: string; path: string; source: string;
  stage: string; value: number; closer: string | null; goal: string | null; notes: string | null;
  consent_email: boolean; consent_sms_calls: boolean; example: boolean; created_at: string;
};
export type Content = {
  id: string; title: string; body: string; type: string; business: string; video_mode: string | null;
  status: string; scheduled_for: string | null; example: boolean; created_at: string;
};
export type Booking = { id: string; title: string; kind: string; starts_at: string; who: string | null; business: string | null; example: boolean };
export type Business = { id: string; business_name: string; [k: string]: any };
export type Post = { id: string; text: string; author_email: string | null; created_at: string };
export type Brand = { app_name: string; tagline: string; logo: string; support_email: string | null };

const DEFAULT_BRAND: Brand = { app_name: "Trellis Reach", tagline: "Marketing App · by QVTrellis", logo: "TR", support_email: null };

// Loads every team table once, then keeps it fresh with Supabase realtime.
export function useTeamData(enabled: boolean) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const db = supabase();
    const [l, c, b, bz, p, s] = await Promise.all([
      db.from("leads").select("*").order("created_at", { ascending: false }).limit(2000),
      db.from("content").select("*").order("created_at", { ascending: false }).limit(1000),
      db.from("bookings").select("*").order("starts_at", { ascending: true }).limit(1000),
      db.from("businesses").select("*").order("created_at", { ascending: false }),
      db.from("posts").select("*").order("created_at", { ascending: false }).limit(200),
      db.from("settings").select("*").eq("id", "brand").maybeSingle(),
    ]);
    const firstErr = [l, c, b, bz, p, s].find((r) => r.error)?.error;
    setError(firstErr ? firstErr.message : "");
    setLeads((l.data as Lead[]) || []);
    setContent((c.data as Content[]) || []);
    setBookings((b.data as Booking[]) || []);
    setBusinesses((bz.data as Business[]) || []);
    setPosts((p.data as Post[]) || []);
    if (s.data) setBrand({ ...DEFAULT_BRAND, ...(s.data as Brand) });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase()
      .channel("team-data")
      .on("postgres_changes", { event: "*", schema: "public" }, () => {
        clearTimeout(timer);
        timer = setTimeout(load, 300); // batch bursts of changes into one reload
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase().removeChannel(channel); };
  }, [enabled, load]);

  return { leads, content, bookings, businesses, posts, brand, error, reload: load };
}

export type TeamData = ReturnType<typeof useTeamData>;
