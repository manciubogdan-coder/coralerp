import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Trash2, GripVertical, GripHorizontal } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

type ColumnRole = "produs" | "cantitate" | "gramaj" | "magazin" | null;
type SeparatorMode = "vertical" | "horizontal";

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  produs: { bg: "rgba(59, 130, 246, 0.15)", border: "rgba(59, 130, 246, 0.8)", text: "#2563eb" },
  cantitate: { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.8)", text: "#16a34a" },
  gramaj: { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.8)", text: "#d97706" },
  magazin: { bg: "rgba(168, 85, 247, 0.15)", border: "rgba(168, 85, 247, 0.8)", text: "#9333ea" },
};

const ROLE_LABELS: Record<string, string> = {
  produs: "🏷️ Produs",
  cantitate: "🔢 Cantitate",
  gramaj: "⚖️ Gramaj",
  magazin: "🏪 Magazin",
};

interface PdfColumnSplitterProps {
  fileData: ArrayBuffer;
  columnRoles: Map<number, ColumnRole>;
  onColumnRoleChange?: (colIdx: number, role: ColumnRole) => void;
  onSeparatorsChange?: (separators: number[]) => void;
  onHorizontalSeparatorsChange?: (separators: number[]) => void;
  initialSeparators?: number[];
  initialHorizontalSeparators?: number[];
}

export default function PdfColumnSplitter({
  fileData,
  columnRoles,
  onColumnRoleChange,
  onSeparatorsChange,
  onHorizontalSeparatorsChange,
  initialSeparators,
  initialHorizontalSeparators,
}: PdfColumnSplitterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Separators
  const [vSeparators, setVSeparators] = useState<number[]>(initialSeparators || []);
  const [hSeparators, setHSeparators] = useState<number[]>(initialHorizontalSeparators || []);

  // Mode: which type of separator to add on double-click
  const [mode, setMode] = useState<SeparatorMode>("vertical");

  // Dragging state
  const [dragging, setDragging] = useState<{ type: "v" | "h"; idx: number } | null>(null);

  const [activePopover, setActivePopover] = useState<{ colIdx: number; x: number; y: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = new Uint8Array(fileData.slice(0));
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fileData]);

  // Render page to image
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    const renderPage = async () => {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) {
        setImageUrl(canvas.toDataURL("image/png"));
        setImageSize({ width: viewport.width, height: viewport.height });
      }
    };
    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, pageNum, scale]);

  // Helpers to get % from mouse event
  const getPercent = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { xPct: 0, yPct: 0 };
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;
    return {
      xPct: Math.max(0, Math.min(100, (x / imageSize.width) * 100)),
      yPct: Math.max(0, Math.min(100, (y / imageSize.height) * 100)),
    };
  }, [imageSize]);

  // Double-click: add separator
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { xPct, yPct } = getPercent(e);
    if (mode === "vertical") {
      setVSeparators(prev => {
        const next = [...prev, xPct].sort((a, b) => a - b);
        onSeparatorsChange?.(next);
        return next;
      });
    } else {
      setHSeparators(prev => {
        const next = [...prev, yPct].sort((a, b) => a - b);
        onHorizontalSeparatorsChange?.(next);
        return next;
      });
    }
  }, [getPercent, mode, onSeparatorsChange, onHorizontalSeparatorsChange]);

  // Start dragging
  const handleSepMouseDown = useCallback((type: "v" | "h", idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ type, idx });
  }, []);

  // Move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const { xPct, yPct } = getPercent(e);
    if (dragging) {
      if (dragging.type === "v") {
        setVSeparators(prev => {
          const next = [...prev];
          next[dragging.idx] = xPct;
          return next;
        });
      } else {
        setHSeparators(prev => {
          const next = [...prev];
          next[dragging.idx] = yPct;
          return next;
        });
      }
    } else {
      setHoverPos({ x: xPct, y: yPct });
    }
  }, [dragging, getPercent]);

  // End drag
  const finishDrag = useCallback(() => {
    if (dragging) {
      if (dragging.type === "v") {
        setVSeparators(prev => {
          const sorted = [...prev].sort((a, b) => a - b);
          onSeparatorsChange?.(sorted);
          return sorted;
        });
      } else {
        setHSeparators(prev => {
          const sorted = [...prev].sort((a, b) => a - b);
          onHorizontalSeparatorsChange?.(sorted);
          return sorted;
        });
      }
      setDragging(null);
    }
  }, [dragging, onSeparatorsChange, onHorizontalSeparatorsChange]);

  const handleMouseUp = useCallback(() => finishDrag(), [finishDrag]);
  const handleMouseLeave = useCallback(() => {
    setHoverPos(null);
    finishDrag();
  }, [finishDrag]);

  // Remove separator
  const removeVSep = useCallback((idx: number) => {
    setVSeparators(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onSeparatorsChange?.(next);
      return next;
    });
  }, [onSeparatorsChange]);

  const removeHSep = useCallback((idx: number) => {
    setHSeparators(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onHorizontalSeparatorsChange?.(next);
      return next;
    });
  }, [onHorizontalSeparatorsChange]);

  // Column zones
  const columnZones = useMemo(() => {
    const sorted = [...vSeparators].sort((a, b) => a - b);
    const zones: { left: number; right: number; idx: number }[] = [];
    let prev = 0;
    for (let i = 0; i < sorted.length; i++) {
      zones.push({ left: prev, right: sorted[i], idx: i });
      prev = sorted[i];
    }
    zones.push({ left: prev, right: 100, idx: sorted.length });
    return zones;
  }, [vSeparators]);

  // Top/bottom bounds from horizontal separators (visible area for data)
  const hBounds = useMemo(() => {
    const sorted = [...hSeparators].sort((a, b) => a - b);
    return sorted;
  }, [hSeparators]);

  // Zone click for role
  const handleZoneClick = useCallback((e: React.MouseEvent, colIdx: number) => {
    if (dragging) return;
    e.stopPropagation();
    if (!onColumnRoleChange) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setActivePopover({
      colIdx,
      x: e.clientX - rect.left + container.scrollLeft,
      y: e.clientY - rect.top + container.scrollTop,
    });
  }, [dragging, onColumnRoleChange]);

  const handleRoleSelect = useCallback((role: ColumnRole) => {
    if (!activePopover || !onColumnRoleChange) return;
    onColumnRoleChange(activePopover.colIdx, role);
    setActivePopover(null);
  }, [activePopover, onColumnRoleChange]);

  return (
    <div className="border rounded-lg bg-muted/30 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted border-b flex-wrap gap-2">
        {/* Pages */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum <= 1} onClick={() => setPageNum(p => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">{pageNum}/{numPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum >= numPages} onClick={() => setPageNum(p => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground font-mono">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
          <Button
            variant={mode === "vertical" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={() => setMode("vertical")}
          >
            <GripVertical className="h-3 w-3" />
            Verticale
          </Button>
          <Button
            variant={mode === "horizontal" ? "default" : "ghost"}
            size="sm"
            className="h-6 text-[10px] gap-1 px-2"
            onClick={() => setMode("horizontal")}
          >
            <GripHorizontal className="h-3 w-3" />
            Orizontale
          </Button>
        </div>

        <Badge variant="secondary" className="text-[10px]">
          {columnZones.length} col · {vSeparators.length}V · {hSeparators.length}H
        </Badge>
      </div>

      {/* Instructions */}
      <div className="flex items-center gap-2 px-3 py-1 border-b bg-accent/30 text-[11px] text-muted-foreground">
        <span>
          <strong>Dublu-click</strong> = adaugă separator {mode === "vertical" ? "vertical (|)" : "orizontal (—)"}.{" "}
          <strong>Trage</strong> linia roșie pt ajustare.{" "}
          <strong>Click</strong> pe zonă = atribuie rol.
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-3 px-3 py-1 border-b bg-muted/50 flex-wrap">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <span key={role} className="flex items-center gap-1 text-[10px]">
            <span
              className="inline-block w-3 h-3 rounded-sm border"
              style={{ backgroundColor: ROLE_COLORS[role]?.bg, borderColor: ROLE_COLORS[role]?.border }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* PDF Image + Overlay */}
      <div
        ref={containerRef}
        className="overflow-auto max-h-[60vh] relative select-none"
        style={{ cursor: dragging ? (dragging.type === "v" ? "col-resize" : "row-resize") : "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
      >
        {imageUrl ? (
          <div className="relative" style={{ width: imageSize.width, height: imageSize.height }}>
            {/* PDF image */}
            <img
              src={imageUrl}
              alt="PDF page"
              style={{ width: imageSize.width, height: imageSize.height, display: "block", pointerEvents: "none" }}
              draggable={false}
            />

            {/* Column zone overlays */}
            {columnZones.map((zone) => {
              const role = columnRoles.get(zone.idx);
              const colors = role ? ROLE_COLORS[role] : null;
              const leftPx = (zone.left / 100) * imageSize.width;
              const widthPx = ((zone.right - zone.left) / 100) * imageSize.width;

              // Clamp to horizontal bounds if any
              const topPx = hBounds.length > 0 ? (hBounds[0] / 100) * imageSize.height : 0;
              const bottomPx = hBounds.length > 1 ? (hBounds[1] / 100) * imageSize.height : imageSize.height;
              const heightPx = bottomPx - topPx;

              return (
                <div
                  key={zone.idx}
                  className="absolute transition-colors"
                  style={{
                    left: leftPx,
                    top: topPx,
                    width: widthPx,
                    height: heightPx,
                    backgroundColor: colors?.bg || "transparent",
                  }}
                  onClick={(e) => handleZoneClick(e, zone.idx)}
                >
                  {role && (
                    <div
                      className="absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-sm z-10"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.9)",
                        color: colors?.text,
                        border: `1px solid ${colors?.border}`,
                      }}
                    >
                      {ROLE_LABELS[role]}
                    </div>
                  )}
                  {!role && widthPx > 30 && (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] text-muted-foreground bg-background/70 border whitespace-nowrap z-10">
                      Col {zone.idx + 1}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Vertical separators */}
            {vSeparators.map((xPct, idx) => {
              const xPx = (xPct / 100) * imageSize.width;
              const isDragging = dragging?.type === "v" && dragging.idx === idx;
              return (
                <div
                  key={`vsep-${idx}`}
                  className="absolute top-0 group"
                  style={{
                    left: xPx - 6,
                    width: 12,
                    height: imageSize.height,
                    cursor: "col-resize",
                    zIndex: 20,
                  }}
                  onMouseDown={(e) => handleSepMouseDown("v", idx, e)}
                >
                  <div
                    className="absolute top-0 left-1/2 -translate-x-1/2"
                    style={{
                      width: isDragging ? 3 : 2,
                      height: imageSize.height,
                      backgroundColor: isDragging ? "hsl(var(--primary))" : "rgba(239, 68, 68, 0.85)",
                    }}
                  />
                  {/* Drag handle */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-8 rounded bg-destructive/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow">
                    <GripVertical className="h-3 w-3 text-white" />
                  </div>
                  {/* Delete button */}
                  <button
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                    onClick={(e) => { e.stopPropagation(); removeVSep(idx); }}
                    title="Șterge separator"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}

            {/* Horizontal separators */}
            {hSeparators.map((yPct, idx) => {
              const yPx = (yPct / 100) * imageSize.height;
              const isDragging = dragging?.type === "h" && dragging.idx === idx;
              return (
                <div
                  key={`hsep-${idx}`}
                  className="absolute left-0 group"
                  style={{
                    top: yPx - 6,
                    height: 12,
                    width: imageSize.width,
                    cursor: "row-resize",
                    zIndex: 20,
                  }}
                  onMouseDown={(e) => handleSepMouseDown("h", idx, e)}
                >
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2"
                    style={{
                      height: isDragging ? 3 : 2,
                      width: imageSize.width,
                      backgroundColor: isDragging ? "hsl(var(--primary))" : "rgba(34, 197, 94, 0.85)",
                    }}
                  />
                  {/* Drag handle */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-5 rounded bg-green-600/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 shadow">
                    <GripHorizontal className="h-3 w-3 text-white" />
                  </div>
                  {/* Label */}
                  <div
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-30"
                    style={{ backgroundColor: "rgba(34,197,94,0.15)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.5)" }}
                  >
                    {idx === 0 ? "▼ Început tabel" : idx === 1 ? "▲ Sfârșit tabel" : `Linie H${idx + 1}`}
                  </div>
                  {/* Delete */}
                  <button
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
                    onClick={(e) => { e.stopPropagation(); removeHSep(idx); }}
                    title="Șterge separator orizontal"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              );
            })}

            {/* Hover guide line */}
            {hoverPos && !dragging && (
              mode === "vertical" ? (
                <div
                  className="absolute top-0 pointer-events-none"
                  style={{
                    left: (hoverPos.x / 100) * imageSize.width - 0.5,
                    width: 1,
                    height: imageSize.height,
                    borderLeft: "1px dashed rgba(239, 68, 68, 0.4)",
                  }}
                />
              ) : (
                <div
                  className="absolute left-0 pointer-events-none"
                  style={{
                    top: (hoverPos.y / 100) * imageSize.height - 0.5,
                    height: 1,
                    width: imageSize.width,
                    borderTop: "1px dashed rgba(34, 197, 94, 0.4)",
                  }}
                />
              )
            )}

            {/* Role picker popover */}
            {activePopover && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                <div
                  className="absolute z-50 bg-popover border rounded-lg shadow-xl p-1 min-w-[160px]"
                  style={{
                    left: Math.min(activePopover.x, imageSize.width - 180),
                    top: Math.min(activePopover.y, imageSize.height - 220),
                  }}
                >
                  <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium border-b mb-1">
                    Coloana {activePopover.colIdx + 1}
                  </p>
                  <button
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                      !columnRoles.get(activePopover.colIdx) && "bg-accent font-medium"
                    )}
                    onClick={() => handleRoleSelect(null)}
                  >
                    ❌ Fără rol
                  </button>
                  {(["produs", "cantitate", "gramaj", "magazin"] as ColumnRole[]).map((role) => (
                    <button
                      key={role}
                      className={cn(
                        "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                        columnRoles.get(activePopover.colIdx) === role && "font-semibold"
                      )}
                      style={
                        columnRoles.get(activePopover.colIdx) === role
                          ? { backgroundColor: ROLE_COLORS[role!].bg }
                          : undefined
                      }
                      onClick={() => handleRoleSelect(role)}
                    >
                      {ROLE_LABELS[role!]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Se încarcă PDF-ul...
          </div>
        )}
      </div>
    </div>
  );
}
