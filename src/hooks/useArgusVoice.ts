import { useEffect, useRef, useState } from "react";
import { ARGUS_URL, argusFetch, argusRequest } from "@/lib/argusApi";
import { speechChunks } from "@/lib/argus/voiceRules";
import { decodePcm16, nextStart, VOICE_RATE, VOICE_FIRST_SEC, VOICE_NEXT_SEC } from "@/lib/viziune/pcmStream";
import { NO_SPEECH_NOTICE } from "../../supabase/functions/_shared/copilotTranscription";

const VOICE_KEY = "argus-future-voice";
const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(new Error("Înregistrarea nu a putut fi citită."));
  reader.readAsDataURL(blob);
});

export function useArgusVoice(onTranscript: (text: string) => void) {
  const [enabled, setEnabled] = useState(() => { try { return localStorage.getItem(VOICE_KEY) !== "off"; } catch { return true; } });
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState("");
  const transcript = useRef(onTranscript); transcript.current = onTranscript;
  const mounted = useRef(true);
  const starting = useRef(false);
  const recorder = useRef<{ recorder: MediaRecorder; stream: MediaStream; timer: ReturnType<typeof setTimeout> } | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const playback = useRef<{ controller: AbortController; sources: Set<AudioBufferSourceNode> } | null>(null);
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  function stopPlayback() {
    const current = playback.current;
    playback.current = null;
    current?.controller.abort();
    for (const source of current?.sources ?? []) { try { source.stop(); } catch { /* already stopped */ } }
    window.speechSynthesis?.cancel();
    if (mounted.current) setPlaying(false);
  }

  /** Called from the click/submit gesture, before waiting for the answer. */
  function unlockAudio() {
    if (!enabled) return;
    try {
      if (!audioContext.current || audioContext.current.state === "closed") audioContext.current = new AudioContext();
      if (audioContext.current.state === "suspended") void audioContext.current.resume().catch(() => undefined);
    } catch { /* browser voice remains available */ }
  }

  async function playChunk(text: string, state: NonNullable<typeof playback.current>): Promise<boolean> {
    const context = audioContext.current;
    if (!context) return false;
    const response = await argusRequest(`${ARGUS_URL}?action=viziune_voice_stream`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: state.controller.signal,
    });
    if (!response.ok || !response.body || !/audio\/L16/i.test(response.headers.get("Content-Type") ?? "")) return false;
    const reader = response.body.getReader();
    let carry: number | null = null;
    let samples: Float32Array[] = [], length = 0, queued = 0, started = false, ended = false;
    let settle = () => {};
    const drained = new Promise<void>(resolve => { settle = resolve; });
    const finish = () => { if (ended && !state.sources.size) settle(); };
    const cancelled = () => settle();
    state.controller.signal.addEventListener("abort", cancelled, { once: true });
    const flush = () => {
      if (!length || state.controller.signal.aborted) return;
      const all = new Float32Array(length);
      let offset = 0;
      for (const part of samples) { all.set(part, offset); offset += part.length; }
      samples = []; length = 0;
      const buffer = context.createBuffer(1, all.length, VOICE_RATE);
      buffer.getChannelData(0).set(all);
      const source = context.createBufferSource();
      source.buffer = buffer; source.connect(context.destination);
      const at = nextStart(context.currentTime, queued);
      queued = at + buffer.duration;
      state.sources.add(source);
      source.onended = () => { state.sources.delete(source); source.disconnect(); finish(); };
      source.start(at); started = true;
    };
    try {
      while (!state.controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        const decoded = decodePcm16(value, carry); carry = decoded.carry;
        samples.push(decoded.samples); length += decoded.samples.length;
        if (length >= VOICE_RATE * (started ? VOICE_NEXT_SEC : VOICE_FIRST_SEC)) flush();
      }
      flush(); ended = true; finish();
      await drained;
      return started;
    } finally {
      state.controller.signal.removeEventListener("abort", cancelled);
      reader.releaseLock();
    }
  }

  async function browserVoice(text: string, state: NonNullable<typeof playback.current>) {
    const synthesis = window.speechSynthesis;
    if (!synthesis || state.controller.signal.aborted) return false;
    const voice = synthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("ro"));
    if (!voice) return false;
    await new Promise<void>(resolve => {
      const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "ro-RO"; utterance.voice = voice;
      const finish = () => { state.controller.signal.removeEventListener("abort", finish); resolve(); };
      utterance.onend = finish; utterance.onerror = finish;
      state.controller.signal.addEventListener("abort", finish, { once: true });
      synthesis.speak(utterance);
    });
    return true;
  }

  async function speak(answer: string) {
    if (!enabled || !answer.trim() || !mounted.current) return;
    stopPlayback(); unlockAudio(); setNotice(""); setPlaying(true);
    const state = { controller: new AbortController(), sources: new Set<AudioBufferSourceNode>() };
    playback.current = state;
    try {
      if (audioContext.current?.state === "suspended") await audioContext.current.resume();
      for (const chunk of speechChunks(answer)) {
        if (state.controller.signal.aborted) break;
        let played = false;
        try { played = await playChunk(chunk, state); }
        catch (error) { if (state.controller.signal.aborted) break; }
        if (!played && !await browserVoice(chunk, state)) {
          if (mounted.current) setNotice("Vocea nu este disponibilă momentan. Răspunsul rămâne în conversație.");
          break;
        }
      }
    } catch { if (!state.controller.signal.aborted && mounted.current) setNotice("Nu pot reda vocea acum. Răspunsul scris este păstrat."); }
    finally { if (playback.current === state) { playback.current = null; if (mounted.current) setPlaying(false); } }
  }

  function stopRecording() {
    const current = recorder.current;
    if (!current) return;
    clearTimeout(current.timer);
    if (current.recorder.state !== "inactive") current.recorder.stop();
  }

  async function startRecording() {
    if (!canRecord || starting.current || recorder.current || transcribing) return;
    starting.current = true;
    stopPlayback(); unlockAudio(); setNotice("");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported(t));
      const instance = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const activeStream = stream;
      instance.onstop = async () => {
        activeStream.getTracks().forEach(track => track.stop());
        const current = recorder.current; if (current) clearTimeout(current.timer);
        recorder.current = null;
        if (!mounted.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: instance.mimeType || "audio/webm" });
        if (!blob.size) { setNotice(NO_SPEECH_NOTICE); return; }
        setTranscribing(true);
        try {
          const result = await argusFetch<{ question?: string; status?: "needs_audio"; notice?: string }>("voice_transcribe", {}, { audio: await toBase64(blob), type: blob.type });
          if (!mounted.current) return;
          if (result.status === "needs_audio" || !result.question?.trim()) setNotice(result.notice || NO_SPEECH_NOTICE);
          else transcript.current(result.question.trim());
        } catch (error) { if (mounted.current) setNotice((error as Error).message || "Nu am putut trimite înregistrarea."); }
        finally { if (mounted.current) setTranscribing(false); }
      };
      const timer = setTimeout(stopRecording, 60_000);
      recorder.current = { recorder: instance, stream, timer };
      instance.start(250); setRecording(true);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (mounted.current) setNotice("Nu am acces la microfon. Permite microfonul sau scrie întrebarea.");
    } finally { starting.current = false; }
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(VOICE_KEY, next ? "on" : "off"); } catch { /* optional preference */ }
    if (!next) stopPlayback();
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; stopPlayback();
      const current = recorder.current;
      if (current) { clearTimeout(current.timer); current.recorder.onstop = null; if (current.recorder.state !== "inactive") current.recorder.stop(); current.stream.getTracks().forEach(track => track.stop()); }
      recorder.current = null;
      void audioContext.current?.close().catch(() => undefined);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { enabled, playing, recording, transcribing, notice, canRecord, toggleEnabled, startRecording, stopRecording, speak, stopPlayback, unlockAudio };
}