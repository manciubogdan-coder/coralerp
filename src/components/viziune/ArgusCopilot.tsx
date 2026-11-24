// Argus inside the 3D factory: ask by voice or text, hear the answer, the camera flies to what it talks about.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { argusFetch } from "@/lib/argusApi";
import { Loader2, Mic, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import type { CopilotTarget } from "../../../supabase/functions/_shared/viziuneCopilotRules";

interface Turn { role: "user" | "assistant"; text: string; target?: CopilotTarget; error?: boolean }
const QUICK = ["Cum stăm cu producția azi?", "Unde avem întârzieri acum?", "Ce camioane mai așteptăm?", "Ce marfă e gata de livrare?", "Când terminăm azi?"];
const VOICE_KEY = "viziune-argus-voce";
const MAX_RECORD_MS = 15_000;

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});
const recorderType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) ?? "";

/** The browser's own Romanian voice, used only if the Argus voice cannot be reached. */
function browserSpeak(text: string) {
  try {
    const synth = window.speechSynthesis;
    const ro = synth?.getVoices().find((v) => v.lang?.toLowerCase().startsWith("ro"));
    if (!synth || !ro) return false;
    const u = new SpeechSynthesisUtterance(text); u.voice = ro; u.lang = ro.lang; synth.cancel(); synth.speak(u);
    return true;
  } catch { return false; }
}

export function ArgusCopilot({ snapshot, onTarget, onDetails, onAsk, open, setOpen, mobile }: {
  /** Live factory picture at the moment of the question. */
  snapshot: () => unknown;
  onTarget: (t: NonNullable<CopilotTarget>) => void;
  onDetails: (t: NonNullable<CopilotTarget>) => void;
  /** Called when a question starts (the page stops the tour). */
  onAsk?: () => void;
  open: boolean; setOpen: (v: boolean) => void; mobile: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"" | "asculta" | "gandeste" | "vorbeste">("");
  const [voice, setVoiceState] = useState(() => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } });
  const setVoice = (v: boolean) => { setVoiceState(v); try { localStorage.setItem(VOICE_KEY, v ? "on" : "off"); } catch { /* private mode */ } if (!v) stopAudio(); };
  const rec = useRef<{ r: MediaRecorder; chunks: Blob[]; timer: number; stream: MediaStream } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const turnsRef = useRef(turns); turnsRef.current = turns;
  const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => () => { stopAudio(); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  function stopAudio() {
    audio.current?.pause(); audio.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
    setBusy((b) => (b === "vorbeste" ? "" : b));
  }

  const speak = async (answer: string) => {
    setBusy("vorbeste");
    try {
      const r = await argusFetch<{ audio?: string; type?: string; error?: string }>("viziune_voice", {}, { text: answer });
      if (!r.audio) throw new Error(r.error || "fără voce");
      const a = new Audio(`data:${r.type || "audio/wav"};base64,${r.audio}`);
      audio.current = a;
      a.onended = () => { if (audio.current === a) { audio.current = null; setBusy(""); } };
      await a.play();
    } catch {
      setBusy("");
      browserSpeak(answer);
    }
  };

  const ask = useCallback(async (payload: { question?: string; audio?: string; type?: string }) => {
    onAsk?.(); stopAudio();
    const history = turnsRef.current.filter((t) => !t.error).slice(-6).map((t) => ({ role: t.role, text: t.text }));
    if (payload.question) setTurns((t) => [...t, { role: "user", text: payload.question! }]);
    setBusy("gandeste");
    try {
      const r = await argusFetch<{ question?: string; answer?: string; target?: CopilotTarget; error?: string }>("viziune_copilot", {}, { ...payload, snapshot: snapshot(), history });
      if (!payload.question && r.question) setTurns((t) => [...t, { role: "user", text: r.question! }]);
      if (!r.answer) throw new Error(r.error || "Argus nu a răspuns.");
      setTurns((t) => [...t, { role: "assistant", text: r.answer!, target: r.target ?? null }]);
      if (r.target) onTarget(r.target);
      if (voice) await speak(r.answer); else setBusy("");
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: (e as Error).message || "Argus nu a putut răspunde acum.", error: true }]);
      setBusy("");
    }
  }, [snapshot, onTarget, onAsk, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => { const q = text.trim(); if (!q || busy === "gandeste") return; setText(""); ask({ question: q }); };

  const startRecording = async () => {
    if (rec.current || busy === "gandeste") return;
    stopAudio(); onAsk?.();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const type = recorderType();
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
        rec.current = null;
        if (blob.size < 1500) { setBusy(""); return; }
        ask({ audio: await toBase64(blob), type: blob.type });
      };
      const timer = window.setTimeout(() => stopRecording(), MAX_RECORD_MS);
      rec.current = { r, chunks, timer, stream };
      r.start(250);
      setBusy("asculta");
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "Nu am acces la microfon. Permite microfonul din bara browserului sau scrie întrebarea.", error: true }]);
      setBusy("");
    }
  };
  function stopRecording() {
    const c = rec.current; if (!c) return;
    clearTimeout(c.timer);
    if (c.r.state !== "inactive") c.r.stop();
  }
  const toggleMic = () => { if (rec.current) stopRecording(); else startRecording(); };

  // M = talk to Argus (press again to send), anywhere on the page except while typing.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat || (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))) return;
      if (ev.key.toLowerCase() !== "m" || !canRecord) return;
      ev.preventDefault(); setOpen(true); toggleMic();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Vorbește cu Argus"
        className={`group absolute z-20 flex items-center gap-2 rounded-full border bg-primary px-4 py-3 font-bold text-primary-foreground shadow-2xl transition hover:scale-105 ${mobile ? "bottom-16 right-2" : "bottom-24 right-3"}`}>
        <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-primary-foreground" /></span>
        <Sparkles className="h-4 w-4" />Întreabă-l pe Argus
      </button>
    );
  }

  const last = [...turns].reverse().find((t) => t.role === "assistant" && t.target);
  return (
    <div className={mobile
      ? "absolute inset-x-0 bottom-0 z-30 flex max-h-[75%] flex-col rounded-t-2xl border-t bg-card shadow-2xl"
      : "absolute bottom-24 right-3 z-30 flex max-h-[min(70%,640px)] w-[min(92vw,420px)] flex-col rounded-2xl border bg-card/95 shadow-2xl backdrop-blur-md"}>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground ${busy ? "animate-pulse" : ""}`}><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <div className="font-black leading-tight">Argus</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {busy === "asculta" ? "Te ascult… apasă din nou când ai terminat" : busy === "gandeste" ? "Se uită prin fabrică…" : busy === "vorbeste" ? "Vorbește…" : "Întreabă orice despre fabrica de azi"}
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setVoice(!voice)} aria-label={voice ? "Oprește vocea" : "Pornește vocea"} title={voice ? "Argus răspunde cu voce" : "Argus răspunde doar în scris"}>
          {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { stopAudio(); setOpen(false); }} aria-label="Închide Argus"><X className="h-4 w-4" /></Button>
      </div>

      <div ref={list} className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {turns.length === 0 && <p className="text-xs text-muted-foreground">Apasă pe microfon (sau tasta <b>M</b>) și vorbește, ori alege o întrebare. Argus răspunde din cifrele live de pe ecran și duce camera acolo unde e răspunsul.</p>}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "ml-8 rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground" : `mr-6 rounded-2xl rounded-bl-sm border px-3 py-2 ${t.error ? "border-destructive text-destructive" : "bg-muted/50"}`}>
            {t.text}
          </div>
        ))}
        {busy === "gandeste" && <div className="mr-6 flex items-center gap-2 rounded-2xl border bg-muted/50 px-3 py-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Argus se uită prin fabrică…</div>}
        {busy === "vorbeste" && (
          <div className="flex items-end gap-0.5 px-1" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="w-1 animate-pulse rounded-full bg-primary" style={{ height: `${8 + ((i * 7) % 14)}px`, animationDelay: `${i * 120}ms` }} />)}
            <button type="button" className="ml-2 text-[11px] text-muted-foreground underline" onClick={stopAudio}>oprește vocea</button>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK.map((q) => <button key={q} type="button" disabled={busy === "gandeste"} onClick={() => ask({ question: q })} className="shrink-0 rounded-full border bg-background px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50">{q}</button>)}
      </div>
      {last?.target && <div className="px-3 pb-2"><Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => { onDetails(last.target!); setOpen(false); }}>Vezi detaliile pe ecran</Button></div>}

      <div className="flex items-center gap-2 border-t p-2">
        {canRecord && (
          <Button size="icon" className={`h-11 w-11 shrink-0 rounded-full ${busy === "asculta" ? "animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive" : ""}`} onClick={toggleMic} disabled={busy === "gandeste"} aria-label={busy === "asculta" ? "Trimite întrebarea" : "Vorbește"}>
            {busy === "asculta" ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Scrie o întrebare…" className="h-11" disabled={busy === "asculta"} />
        <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" onClick={submit} disabled={!text.trim() || busy === "gandeste"} aria-label="Trimite"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
