"use client";
import { createContext, useCallback, useContext, useState } from "react";

export const money = (n: number) => "$" + Math.round(n || 0).toLocaleString();
export const when = (t?: string | null) =>
  t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

const ToastCtx = createContext<(t: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const show = useCallback((t: string) => {
    setMsg(t);
    setTimeout(() => setMsg((m) => (m === t ? "" : m)), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast" role="status">{msg}</div>}
    </ToastCtx.Provider>
  );
}

export function Bars({ pairs, isMoney }: { pairs: [string, number][]; isMoney?: boolean }) {
  const max = Math.max(1, ...pairs.map((p) => p[1]));
  return (
    <div className="bars">
      {pairs.map(([k, v]) => (
        <div className="bar" key={k}>
          <span>{k}</span>
          <div className="track"><div className={"fill" + (isMoney ? " rev" : "")} style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="num">{isMoney ? money(v) : v}</span>
        </div>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Head({ eyebrow, title, lead }: { eyebrow: string; title: string; lead?: string }) {
  return (
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  );
}

export async function copyText(text: string, toast: (t: string) => void) {
  try { await navigator.clipboard.writeText(text); toast("Copied"); }
  catch { toast("Copy blocked here. Select the text instead."); }
}
