import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Home, LogOut, RotateCcw, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { NavAction } from "@/lib/viziune/cameraNav";

/**
 * On-screen camera pad for the 3D factory, plus a quick jump to any line. Keyboard does the same.
 * While walking (`onHold`), the arrows walk / turn for as long as they are held down.
 */
export function NavPad({ onNav, onHome, lines, onLine, onHold }: {
  onNav: (a: NavAction) => void; onHome: () => void;
  lines: { id: string; name: string; workers: number; late: boolean }[]; onLine: (id: string) => void;
  onHold?: (a: NavAction, down: boolean) => void;
}) {
  const b = (a: NavAction, icon: React.ReactNode, title: string) => onHold ? (
    <Button size="icon" variant="secondary" className="h-10 w-10 touch-none select-none" title={title} aria-label={title}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onHold(a, true); }}
      onPointerUp={() => onHold(a, false)} onPointerCancel={() => onHold(a, false)} onLostPointerCapture={() => onHold(a, false)}>{icon}</Button>
  ) : (
    <Button size="icon" variant="secondary" className="h-9 w-9" title={title} aria-label={title} onClick={() => onNav(a)}>{icon}</Button>
  );
  return (
    <div className="absolute bottom-16 left-3 z-10 flex flex-col gap-2 rounded-lg border bg-card/95 p-2 shadow">
      {!onHold && <Select value="" onValueChange={onLine}>
        <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Mergi la linia…" /></SelectTrigger>
        <SelectContent className="max-h-72 overflow-y-auto">
          {lines.map((l) => <SelectItem key={l.id} value={l.id} className="text-xs">{l.late ? "⚠ " : ""}{l.name}{l.workers ? ` · 👷 ${l.workers}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>}
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-3 gap-1">
          {b("rotStanga", <RotateCcw className="h-4 w-4" />, onHold ? "Întoarce-te la stânga (Q sau ←)" : "Rotește spre stânga (Q)")}
          {b("inainte", <ArrowUp className="h-4 w-4" />, "Înainte (↑ sau W)")}
          {b("rotDreapta", <RotateCw className="h-4 w-4" />, onHold ? "Întoarce-te la dreapta (E sau →)" : "Rotește spre dreapta (E)")}
          {b("stanga", <ArrowLeft className="h-4 w-4" />, onHold ? "Pas lateral stânga (A)" : "Stânga (← sau A)")}
          <Button size="icon" variant="outline" className={onHold ? "h-10 w-10" : "h-9 w-9"} title={onHold ? "Ieși din plimbare" : "Toată fabrica"} aria-label={onHold ? "Ieși din plimbare" : "Toată fabrica"} onClick={onHome}>
            {onHold ? <LogOut className="h-4 w-4" /> : <Home className="h-4 w-4" />}
          </Button>
          {b("dreapta", <ArrowRight className="h-4 w-4" />, onHold ? "Pas lateral dreapta (D)" : "Dreapta (→ sau D)")}
          <span />
          {b("inapoi", <ArrowDown className="h-4 w-4" />, "Înapoi (↓ sau S)")}
          <span />
        </div>
        {!onHold && <div className="flex flex-col gap-1">
          {b("aproape", <ZoomIn className="h-4 w-4" />, "Mai aproape (+)")}
          {b("departe", <ZoomOut className="h-4 w-4" />, "Mai departe (−)")}
        </div>}
      </div>
    </div>
  );
}
