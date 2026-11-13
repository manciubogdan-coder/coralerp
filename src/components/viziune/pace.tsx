import React from "react";
import type { LinePace } from "@/lib/viziune/factoryState";

export const clockTime = (ms: number | null | undefined) =>
  ms == null || !isFinite(ms) ? "—" : new Date(ms).toLocaleTimeString("ro-RO", { timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit" });

export const minutesLabel = (min: number) => {
  if (min > 0 && min < 1) return "<1 min";
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
};

const PACE: Record<LinePace["status"], { label: string; cls: string } | null> = {
  in_norma: { label: "în normă", cls: "bg-crm-green/15 text-crm-green" },
  aproape: { label: "aproape de normă", cls: "bg-crm-warning/15 text-crm-warning" },
  intarziat: { label: "peste normă", cls: "bg-destructive text-destructive-foreground animate-pulse" },
  fara_norma: { label: "fără normă", cls: "bg-muted text-muted-foreground" },
  liber: null,
};

export function PaceBadge({ pace }: { pace: LinePace }) {
  const p = PACE[pace.status];
  if (!p) return null;
  return <span className={`shrink-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-bold uppercase ${p.cls}`}>{pace.status === "intarziat" ? `+${minutesLabel(pace.lateMinutes)}` : p.label}</span>;
}
