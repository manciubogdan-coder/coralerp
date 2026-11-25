// Argus inside the 3D factory: ask by voice or text, hear the answer, the camera flies to what it talks about.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { argusFetch, argusRequest, ARGUS_URL } from "@/lib/argusApi";
import { decodePcm16, nextStart, VOICE_FIRST_SEC, VOICE_NEXT_SEC, VOICE_RATE } from "@/lib/viziune/pcmStream";
import { Loader2, Mic, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import type { CopilotTarget } from "../../../supabase/functions/_shared/viziuneCopilotRules";
import { NO_SPEECH_NOTICE } from "../../../supabase/functions/_shared/copilotTranscription";

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
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "asculta" | "gandeste" | "vorbeste">("");
  const [voice, setVoiceState] = useState(() => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } });
  const setVoice = (v: boolean) => { setVoiceState(v); try { localStorage.setItem(VOICE_KEY, v ? "on" : "off"); } catch { /* private mode */ } if (!v) stopAudio(); };
  const rec = useRef<{ r: MediaRecorder; chunks: Blob[]; timer: number; stream: MediaStream } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<{ stop: () => void } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const turnsRef = useRef(turns); turnsRef.current = turns;
  const canRecord = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [turns, busy]);
  useEffect(() => () => { stopAudio(); rec.current?.stream.getTracks().forEach((t) => t.stop()); void ctx.current?.close().catch(() => undefined); }, []);

  function stopAudio() {
    audio.current?.pause(); audio.current = null;
    stream.current?.stop(); stream.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* not supported */ }
    setBusy((b) => (b === "vorbeste" ? "" : b));
  }

  /** Created inside the click/key press that asks, so the browser lets it play later. */
  const unlockAudio = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!ctx.current || ctx.current.state === "closed") ctx.current = new Ctx();
      if (ctx.current.state === "suspended") void ctx.current.resume();
    } catch { /* no Web Audio */ }
  };

  /** Plays the voice while it is still being made: the first words start in about a second. */
  const speakStreamed = async (answer: string): Promise<boolean> => {
    const ac = ctx.current;
    if (!ac || typeof ReadableStream === "undefined") return false;
    if (ac.state === "suspended") await ac.resume().catch(() => undefined);
    const ctrl = new AbortController();
    const sources = new Set<AudioBufferSourceNode>();
    let queuedUntil = 0, ended = false, started = false;
    const finish = () => { if (ended && sources.size === 0 && stream.current === play) { stream.current = null; setBusy((b) => (b === "vorbeste" ? "" : b)); } };
    const play = { stop: () => { ctrl.abort(); sources.forEach((src) => { try { src.stop(); } catch { /* already stopped */ } }); sources.clear(); } };
    stream.current = play;
    const schedule = (pcm: Float32Array) => {
      if (!pcm.length || stream.current !== play) return;
      const buf = ac.createBuffer(1, pcm.length, VOICE_RATE);
      buf.getChannelData(0).set(pcm);
      const src = ac.createBufferSource();
      src.buffer = buf; src.connect(ac.destination);
      const at = nextStart(ac.currentTime, queuedUntil);
      src.start(at); queuedUntil = at + buf.duration; started = true;
      sources.add(src);
      src.onended = () => { sources.delete(src); finish(); };
    };
    try {
      const res = await argusRequest(`${ARGUS_URL}?action=viziune_voice_stream`, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answer }),
      });
      if (!res.ok || !res.body || !/audio/i.test(res.headers.get("content-type") ?? "")) return false;
      const reader = res.body.getReader();
      let carry: number | null = null, pending: Float32Array[] = [], pendingLen = 0;
      const flush = () => {
        if (!pendingLen) return;
        const all = new Float32Array(pendingLen); let o = 0;
        for (const p of pending) { all.set(p, o); o += p.length; }
        pending = []; pendingLen = 0; schedule(all);
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const d = decodePcm16(value, carry); carry = d.carry;
        pending.push(d.samples); pendingLen += d.samples.length;
        if (pendingLen >= VOICE_RATE * (started ? VOICE_NEXT_SEC : VOICE_FIRST_SEC)) flush();
      }
      flush();
      ended = true; finish();
      return started;
    } catch {
      ended = true; finish();
      return started || ctrl.signal.aborted;
    }
  };

  const speak = async (answer: string) => {
    setBusy("vorbeste");
    if (await speakStreamed(answer)) return;
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
    onAsk?.(); stopAudio(); if (voice) unlockAudio();
    setNotice("");
    const history = turnsRef.current.filter((t) => !t.error).slice(-6).map((t) => ({ role: t.role, text: t.text }));
    const question = payload.question;
    if (question) setTurns((t) => [...t, { role: "user", text: question }]);
    setBusy("gandeste");
    try {
      const r = await argusFetch<{ question?: string; answer?: string; target?: CopilotTarget; error?: string; status?: "needs_audio"; notice?: string }>("viziune_copilot", {}, { ...payload, snapshot: snapshot(), history });
      if (r.status === "needs_audio") {
        setNotice(r.notice || NO_SPEECH_NOTICE);
        setBusy("");
        return;
      }
      const heardQuestion = r.question;
      if (!payload.question && heardQuestion) setTurns((t) => [...t, { role: "user", text: heardQuestion }]);
      const answer = r.answer;
      if (!answer) throw new Error(r.error || "Argus nu a răspuns.");
      setTurns((t) => [...t, { role: "assistant", text: answer, target: r.target ?? null }]);
      if (r.target) onTarget(r.target);
      if (voice) await speak(answer); else setBusy("");
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: (e as Error).message || "Argus nu a putut răspunde acum.", error: true }]);
      setBusy("");
    }
  }, [snapshot, onTarget, onAsk, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => { const q = text.trim(); if (!q || busy === "gandeste") return; setText(""); ask({ question: q }); };

  const startRecording = async () => {
    if (rec.current || busy === "gandeste") return;
    stopAudio(); onAsk?.(); setNotice("");
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
        if (blob.size < 1500) { setNotice(NO_SPEECH_NOTICE); setBusy(""); return; }
        try { await ask({ audio: await toBase64(blob), type: blob.type }); }
        catch { setNotice("Înregistrarea nu a putut fi trimisă. Mai încearcă."); setBusy(""); }
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
  const toggleMic = () => { if (voice) unlockAudio(); if (rec.current) stopRecording(); else startRecording(); };

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
        className={`group absolute z-20 flex items-center gap-1.5 rounded-full border bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-2xl transition hover:scale-105 ${mobile ? "bottom-20 right-2" : "bottom-20 right-2"}`}>
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-foreground" /></span>
        <Sparkles className="h-3.5 w-3.5" />Întreabă-l pe Argus
      </button>
    );
  }

  const last = [...turns].reverse().find((t) => t.role === "assistant" && t.target);
  return (
    <div className={mobile
      ? "absolute inset-x-0 bottom-0 z-30 flex max-h-[62%] flex-col rounded-t-2xl border-t bg-card shadow-2xl"
      : "absolute bottom-20 right-2 z-30 flex max-h-[min(58%,440px)] w-[min(88vw,330px)] flex-col rounded-xl border bg-card/95 shadow-2xl backdrop-blur-md"}>
      <div className="flex items-center gap-1.5 border-b px-2 py-1">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground ${busy ? "animate-pulse" : ""}`}><Sparkles className="h-3.5 w-3.5" /></div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black leading-tight">Argus</div>
          <div className="truncate text-[10px] text-muted-foreground">
            {busy === "asculta" ? "Te ascult… apasă din nou când ai terminat" : busy === "gandeste" ? "Verifică datele…" : busy === "vorbeste" ? "Vorbește…" : "Producție · consumuri · Senior"}
          </div>
        </div>
        <Button size="icon-xs" variant="ghost" onClick={() => setVoice(!voice)} aria-label={voice ? "Oprește vocea" : "Pornește vocea"} title={voice ? "Argus răspunde cu voce" : "Argus răspunde doar în scris"}>
          {voice ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon-xs" variant="ghost" onClick={() => { stopAudio(); setOpen(false); }} aria-label="Închide Argus"><X className="h-3.5 w-3.5" /></Button>
      </div>

      <div ref={list} className="flex-1 space-y-1.5 overflow-y-auto p-2 text-xs">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "ml-6 rounded-xl rounded-br-sm bg-primary px-2 py-1.5 text-primary-foreground" : `mr-4 rounded-xl rounded-bl-sm border px-2 py-1.5 ${t.error ? "border-destructive text-destructive" : "bg-muted/50"}`}>
            {t.text}
          </div>
        ))}
        {busy === "gandeste" && <div className="mr-4 flex items-center gap-2 rounded-xl border bg-muted/50 px-2 py-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Argus verifică datele…</div>}
        {busy === "vorbeste" && (
          <div className="flex items-end gap-0.5 px-1" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="w-1 animate-pulse rounded-full bg-primary" style={{ height: `${8 + ((i * 7) % 14)}px`, animationDelay: `${i * 120}ms` }} />)}
            <button type="button" className="ml-2 text-[11px] text-muted-foreground underline" onClick={stopAudio}>oprește vocea</button>
          </div>
        )}
      </div>

      {notice && <div role="status" className="border-t px-2 py-1.5 text-xs text-muted-foreground">{notice}</div>}
      <div className="flex gap-1 overflow-x-auto px-2 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {QUICK.map((q) => <button key={q} type="button" disabled={busy === "gandeste"} onClick={() => ask({ question: q })} className="shrink-0 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium hover:bg-muted disabled:opacity-50">{q}</button>)}
      </div>
      {last?.target && <div className="px-2 pb-1.5"><Button size="sm" variant="outline" className="h-6 w-full text-[10px]" onClick={() => { const target = last.target; if (!target) return; onDetails(target); setOpen(false); }}>Vezi detaliile pe ecran</Button></div>}

      <div className="flex items-center gap-1.5 border-t p-1.5">
        {canRecord && (
          <Button size="icon" className={`h-9 w-9 shrink-0 rounded-full ${busy === "asculta" ? "animate-pulse bg-destructive text-destructive-foreground hover:bg-destructive" : ""}`} onClick={toggleMic} disabled={busy === "gandeste"} aria-label={busy === "asculta" ? "Trimite întrebarea" : "Vorbește"}>
            {busy === "asculta" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Scrie o întrebare…" className="h-8 text-xs" disabled={busy === "asculta"} />
        <Button size="icon-xs" variant="ghost" className="h-8 w-8 shrink-0" onClick={submit} disabled={!text.trim() || busy === "gandeste"} aria-label="Trimite"><Send className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
