// Presentation mode of Viziune: live badge, cinematic tour controller and its caption card.
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Pause, Play, X } from "lucide-react";
import type { TourStop } from "@/lib/viziune/presentation";

/** Pulsing "LIVE" with the age of the data, ticking every second. */
export function LiveBadge({ updatedAt, className = "" }: { updatedAt: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const age = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  const fresh = age != null && age < 90;
  return (
    <div className={`flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1 text-[11px] font-semibold shadow ${className}`}>
      <span className="relative flex h-2.5 w-2.5">
        {fresh && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crm-green opacity-75" />}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${fresh ? "bg-crm-green" : "bg-crm-warning"}`} />
      </span>
      <span className="tracking-widest">LIVE</span>
      <span className="font-normal text-muted-foreground">
        producție + Senior ERP · {age == null ? "se încarcă…" : age < 5 ? "acum" : age < 60 ? `acum ${age} s` : `acum ${Math.round(age / 60)} min`}
      </span>
    </div>
  );
}

/** Runs the tour: one stop after another, each for its own seconds; `onGo` moves the camera. */
export function useTour(stops: TourStop[], onGo: (stop: TourStop) => void) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const go = useRef(onGo); go.current = onGo;
  const list = useRef(stops); list.current = stops;
  const count = stops.length;
  // Move the camera only when the stop changes (fresh figures every 30 s must not restart the flight).
  useEffect(() => { if (running) { const s = list.current[index]; if (s) go.current(s); } }, [running, index]);
  useEffect(() => {
    if (!running || paused) return;
    const s = list.current[index];
    const t = setTimeout(() => setIndex((i) => (i + 1) % Math.max(1, list.current.length)), (s?.seconds ?? 8) * 1000);
    return () => clearTimeout(t);
  }, [running, paused, index]);
  return {
    running, paused, index: Math.min(index, Math.max(0, count - 1)), stop: running ? stops[Math.min(index, count - 1)] ?? null : null, count,
    start: () => { setIndex(0); setPaused(false); setRunning(true); },
    end: () => { setRunning(false); setPaused(false); },
    toggle: () => setPaused((p) => !p),
    next: () => setIndex((i) => (i + 1) % Math.max(1, count)),
    prev: () => setIndex((i) => (i - 1 + count) % Math.max(1, count)),
  };
}

export function TourOverlay({ tour, mobile }: { tour: ReturnType<typeof useTour>; mobile: boolean }) {
  const s = tour.stop;
  if (!s) return null;
  return (
    <div className={`pointer-events-none absolute z-10 ${mobile ? "inset-x-2 bottom-2" : "bottom-6 left-1/2 w-[min(92vw,720px)] -translate-x-1/2"}`}>
      <div key={s.key} className="pointer-events-auto overflow-hidden rounded-2xl border bg-card/90 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className={mobile ? "p-3" : "px-6 pb-4 pt-5"}>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary">{s.kicker}</div>
          <div className={`font-black leading-tight ${mobile ? "text-xl" : "text-4xl"}`}>{s.title}</div>
          <div className={`mt-3 flex flex-wrap gap-2 ${mobile ? "text-xs" : "text-base"}`}>
            {s.facts.map((f, i) => (
              <span key={i} className="rounded-full border bg-background/70 px-3 py-1 font-semibold tabular-nums animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${300 + i * 250}ms`, animationFillMode: "both" }}>{f}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 border-t bg-background/40 px-2 py-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={tour.prev} aria-label="Oprirea anterioară"><ChevronLeft className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={tour.toggle} aria-label={tour.paused ? "Continuă turul" : "Pauză"}>{tour.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={tour.next} aria-label="Oprirea următoare"><ChevronRight className="h-4 w-4" /></Button>
          <div className="mx-2 flex flex-1 gap-1">
            {Array.from({ length: tour.count }).map((_, i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                {i < tour.index && <div className="h-full w-full bg-primary" />}
                {i === tour.index && <div key={s.key} className="h-full bg-primary" style={{ animation: `viziune-tour-progress ${s.seconds}s linear forwards`, animationPlayState: tour.paused ? "paused" : "running" }} />}
              </div>
            ))}
          </div>
          <span className="hidden text-[10px] text-muted-foreground sm:inline">P = pornește/oprește · M = vorbește cu Argus</span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={tour.end} aria-label="Oprește turul"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <style>{`@keyframes viziune-tour-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
