"use client";
import { useState } from "react";
import { api } from "@/lib/supabaseClient";
import { MINOR_RELEASE_TERMS, RELEASE_TERMS } from "@/lib/constants";
import { copyText, useToast } from "./ui";

export type ReleaseInfo = { shown: "nobody" | "me" | "other" | "child"; personName: string; personEmail: string; business: string; products: string; signature: string; agree: boolean;
  guardianName: string; relationship: string; guardianHere: boolean };
export const EMPTY_RELEASE: ReleaseInfo = { shown: "nobody", personName: "", personEmail: "", business: "", products: "", signature: "", agree: false, guardianName: "", relationship: "", guardianHere: true };

export function releaseReady(r: ReleaseInfo) {
  if (r.shown === "nobody") return true;
  if (r.shown === "me") return r.agree && r.signature.trim().length >= 3 && r.personName.trim().length > 0;
  if (r.shown === "child") return r.personName.trim().length > 0 && r.guardianName.trim().length > 0 && r.relationship.trim().length > 0 && (!r.guardianHere || (r.agree && r.signature.trim().length >= 3));
  return r.personName.trim().length > 0;
}

// Saves the release after the ad is saved. "me" is signed now; "other" gets a link to sign.
export async function saveRelease(r: ReleaseInfo, opts: { mediaUrl?: string | null; contentId?: string | null; entryId?: string | null }) {
  if (r.shown === "nobody") return null;
  return api("/api/release", { ...r, isSelf: r.shown === "me" || (r.shown === "child" && r.guardianHere), isMinor: r.shown === "child", ...opts });
}

// "Who's in it?" and the media release, shown right under any upload.
export function ReleaseBox({ value, onChange, defaultBusiness = "" }: { value: ReleaseInfo; onChange: (r: ReleaseInfo) => void; defaultBusiness?: string }) {
  const set = (p: Partial<ReleaseInfo>) => onChange({ ...value, ...p });
  const biz = value.business || defaultBusiness;
  return (
    <div className="form" style={{ gap: 8 }}>
      <b>Is a person shown in it?</b>
      <div className="row">
        {(["nobody", "me", "other", "child"] as const).map((k) => (
          <button key={k} type="button" className={"btn small" + (value.shown === k ? " primary" : "")} onClick={() => set({ shown: k })}>
            {k === "nobody" ? "No one" : k === "me" ? "Me" : k === "other" ? "Someone else" : "A child (under 18)"}
          </button>
        ))}
      </div>
      {value.shown === "child" && (<>
        <div className="two">
          <label>Child's first name only<input value={value.personName} onChange={(e) => set({ personName: e.target.value.split(" ")[0] })} /></label>
          <label>Parent or guardian's full name<input value={value.guardianName} onChange={(e) => set({ guardianName: e.target.value })} /></label>
          <label>Relationship<select value={value.relationship} onChange={(e) => set({ relationship: e.target.value })}><option value="">Choose</option><option>Parent</option><option>Legal guardian</option></select></label>
          <label>Business<input value={biz} onChange={(e) => set({ business: e.target.value })} /></label>
          <label>Products shown (optional)<input value={value.products} onChange={(e) => set({ products: e.target.value })} /></label>
        </div>
        <div className="row">
          <button type="button" className={"btn small" + (value.guardianHere ? " primary" : "")} onClick={() => set({ guardianHere: true })}>I'm the parent/guardian</button>
          <button type="button" className={"btn small" + (!value.guardianHere ? " primary" : "")} onClick={() => set({ guardianHere: false })}>Send them a link</button>
        </div>
        {value.guardianHere ? (<>
          <details><summary className="note" style={{ cursor: "pointer" }}>Read the parent/guardian release</summary><div className="out" style={{ marginTop: 6, fontSize: 13 }}>{MINOR_RELEASE_TERMS(value.personName, value.guardianName, biz, value.products)}</div></details>
          <label className="checkline"><input type="checkbox" checked={value.agree} onChange={(e) => set({ agree: e.target.checked })} /><span>I'm this child's parent or legal guardian, I'm 18+, and I agree.</span></label>
          <label>Parent/guardian: type your full name to sign<input value={value.signature} onChange={(e) => set({ signature: e.target.value })} /></label>
        </>) : (<>
          <label>Parent/guardian's email (optional)<input type="email" value={value.personEmail} onChange={(e) => set({ personEmail: e.target.value })} /></label>
          <p className="note" style={{ margin: 0 }}>After you save, you'll get a link for the parent or guardian to sign. It stays "Waiting for signature" until they do.</p>
        </>)}
      </>)}
      {(value.shown === "me" || value.shown === "other") && (<>
        <div className="two">
          <label>{value.shown === "me" ? "Your full name" : "Their full name"}<input value={value.personName} onChange={(e) => set({ personName: e.target.value })} /></label>
          {value.shown === "other" && <label>Their email (optional)<input type="email" value={value.personEmail} onChange={(e) => set({ personEmail: e.target.value })} /></label>}
          <label>Business<input value={biz} onChange={(e) => set({ business: e.target.value })} /></label>
          <label>Products shown (optional)<input value={value.products} onChange={(e) => set({ products: e.target.value })} placeholder="e.g. roof installs, our logo" /></label>
        </div>
        {value.shown === "me" ? (<>
          <details><summary className="note" style={{ cursor: "pointer" }}>Read the release</summary><div className="out" style={{ marginTop: 6, fontSize: 13 }}>{RELEASE_TERMS(value.personName, biz, value.products)}</div></details>
          <label className="checkline"><input type="checkbox" checked={value.agree} onChange={(e) => set({ agree: e.target.checked })} /><span>I agree to the release for future advertising and promotions.</span></label>
          <label>Type your full name to sign<input value={value.signature} onChange={(e) => set({ signature: e.target.value })} /></label>
        </>) : (
          <p className="note" style={{ margin: 0 }}>After you save, you'll get a link to send them. It stays marked "Waiting for signature" until they sign.</p>
        )}
      </>)}
    </div>
  );
}

// Shown after saving when someone else needs to sign.
export function SignLink({ id }: { id: string }) {
  const toast = useToast();
  const link = typeof window !== "undefined" ? `${window.location.origin}/release/${id}` : "";
  return (
    <div className="warn" style={{ display: "grid", gap: 6 }}>
      <b>Send this link to the person shown so they can sign:</b>
      <div className="row"><input readOnly value={link} style={{ flex: 1, minWidth: 0 }} /><button className="btn small" type="button" onClick={() => copyText(link, toast)}>Copy</button></div>
    </div>
  );
}
