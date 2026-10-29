"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// Voice-first input. Uses the browser's built-in speech recognition (Chrome, Edge, Safari,
// Samsung Internet). Firefox has none, so the button explains to use the keyboard mic instead.

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null;
};

function getRecognition(): Rec | null {
  if (typeof window === "undefined") return null;
  const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return C ? (new C() as Rec) : null;
}

export function speechSupported() {
  return typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

// Listens once. Calls onFinal with the whole phrase when the person stops talking.
export function useListen(onFinal: (text: string) => void, onEmpty?: () => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<Rec | null>(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;
  const emptyRef = useRef(onEmpty);
  emptyRef.current = onEmpty;

  const stop = useCallback(() => { rec.current?.stop(); }, []);

  const start = useCallback(() => {
    setError("");
    const r = getRecognition();
    if (!r) { setError("This browser can't listen. Use Chrome, Edge or Safari, or tap the mic on your keyboard."); return; }
    rec.current?.abort();
    rec.current = r;
    r.lang = navigator.language || "en-US";
    r.continuous = false;
    r.interimResults = true;
    let finalText = "";
    let blocked = false;
    r.onresult = (e: any) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else live += t;
      }
      setInterim((finalText + " " + live).trim());
    };
    r.onerror = (e: any) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") blocked = true;
      if (code === "not-allowed" || code === "service-not-allowed") setError("Microphone is blocked. Allow it in your browser's site settings, then try again.");
      else if (code === "no-speech") setError("I didn't hear anything. Tap the mic and try again.");
      else if (code !== "aborted") setError("Listening stopped. Tap the mic to try again.");
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      const t = finalText.trim();
      if (t) finalRef.current(t);
      else if (!blocked) emptyRef.current?.();
    };
    try { r.start(); setListening(true); } catch { setError("Couldn't start the microphone. Try again."); }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);
  return { listening, interim, error, start, stop };
}

// Reads text aloud with the device's voice. Resolves when finished, when stopped, or (because
// some phones never report "finished") after the time the words should take, so nothing hangs.
let finishSpeaking: (() => void) | null = null;
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const clean = text.replace(/[*_#`]/g, "").trim();
    if (!clean) return resolve();
    // Short sentences: long ones can stop halfway on some browsers.
    const parts = clean.match(/[^.!?\n]+[.!?]*/g)?.map((p) => p.trim()).filter(Boolean) || [clean];
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); finishSpeaking = null; resolve(); };
    finishSpeaking = () => { synth.cancel(); finish(); };
    const words = clean.split(/\s+/).length;
    const timer = setTimeout(finish, (words / 2.3) * 1000 + 2500);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = navigator.language || "en-US";
      u.rate = 1.02;
      if (i === parts.length - 1) u.onend = finish;
      u.onerror = finish;
      synth.speak(u);
    });
  });
}

export function stopSpeaking() {
  if (finishSpeaking) finishSpeaking();
  else if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

// Small mic button for any text field. Adds what you say to the field.
export function MicButton({ onText, label = "Speak" }: { onText: (t: string) => void; label?: string }) {
  const { listening, interim, error, start, stop } = useListen(onText);
  return (
    <span style={{ display: "inline-grid", gap: 4 }}>
      <button
        type="button"
        className={"mic" + (listening ? " on" : "")}
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : label}
      >
        <span className="mic-dot" aria-hidden="true">🎤</span>{listening ? "Listening… tap to stop" : label}
      </button>
      {interim && <span className="note">{interim}</span>}
      {error && <span className="err">{error}</span>}
    </span>
  );
}
