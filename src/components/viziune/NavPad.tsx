import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Home, LogOut, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NavAction } from "@/lib/viziune/cameraNav";

/**
 * On-screen camera pad for the 3D factory, plus a quick jump to any line. Keyboard does the same.
 * While walking (`onHold`), the arrows walk / turn for as long as they are held down.
 */
export function NavPad({ onNav, onHome, lines, onLine, onHold, hideLines, className }: {
  onNav: (a: NavAction) => void; onHome: () => void;
  lines: { id: string; name: string; workers: number; late: boolean }[]; onLine: (id: string) => void;
  onHold?: (a: NavAction, down: boolean) => void;
  /** Phones show the line list in their own bottom bar. */
  hideLines?: boolean;
  className?: string;
}) {
  const b = (a: NavAction, icon: React.ReactNode, title: string) => onHold ? (
    <Button size="icon" variant="secondary" className="h-11 w-11 touch-none select-none" title={title} aria-label={title}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHold(a, true); }}
      onPointerUp={() => onHold(a, false)} onPointerCancel={() => onHold(a, false)} onLostPointerCapture={() => onHold(a, false)}>{icon}</Button>
  ) : (
    <Button size="icon-xs" variant="secondary" className="h-7 w-7" title={title} aria-label={title} onClick={() => onNav(a)}>{icon}</Button>
  );
  return (
    <div className={`absolute z-10 flex flex-col gap-1.5 rounded-lg border bg-card/95 p-1.5 shadow ${className ?? "bottom-14 left-2"}`}>
      {!onHold && !hideLines && <Select value="" onValueChange={onLine}>
        <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue placeholder="Mergi la linia…" /></SelectTrigger>
        <SelectContent className="max-h-72 overflow-y-auto">
          {lines.map((l) => <SelectItem key={l.id} value={l.id} className="text-xs">{l.late ? "⚠ " : ""}{l.name}{l.workers ? ` · 👷 ${l.workers}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>}
      <div className="flex items-center gap-1.5">
        <div className="grid grid-cols-3 gap-1">
          {b("rotStanga", <RotateCcw className="h-3.5 w-3.5" />, onHold ? "Întoarce-te la stânga (Q sau ←)" : "Rotește spre stânga (Q)")}
          {b("inainte", <ArrowUp className="h-3.5 w-3.5" />, "Înainte (↑ sau W)")}
          {b("rotDreapta", <RotateCw className="h-3.5 w-3.5" />, onHold ? "Întoarce-te la dreapta (E sau →)" : "Rotește spre dreapta (E)")}
          {b("stanga", <ArrowLeft className="h-3.5 w-3.5" />, onHold ? "Pas lateral stânga (A)" : "Stânga (← sau A)")}
          <Button size="icon-xs" variant="outline" className={onHold ? "h-11 w-11" : "h-7 w-7"} title={onHold ? "Ieși din plimbare" : "Toată fabrica"} aria-label={onHold ? "Ieși din plimbare" : "Toată fabrica"} onClick={onHome}>
            {onHold ? <LogOut className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
          </Button>
          {b("dreapta", <ArrowRight className="h-3.5 w-3.5" />, onHold ? "Pas lateral dreapta (D)" : "Dreapta (→ sau D)")}
          <span />
          {b("inapoi", <ArrowDown className="h-3.5 w-3.5" />, "Înapoi (↓ sau S)")}
          <span />
        </div>
        {!onHold && <div className="flex flex-col gap-1">
          {b("aproape", <ZoomIn className="h-3.5 w-3.5" />, "Mai aproape (+)")}
          {b("departe", <ZoomOut className="h-3.5 w-3.5" />, "Mai departe (−)")}
        </div>}
      </div>
    </div>
  );
}
