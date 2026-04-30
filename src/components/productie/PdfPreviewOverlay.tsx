import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

type ColumnRole = "produs" | "cantitate" | "gramaj" | "magazin" | null;

interface PdfPreviewOverlayProps {
  fileData: ArrayBuffer;
  columnRoles: Map<number, ColumnRole>;
  headerRow: number;
  rawData: any[][];
  onColumnRoleChange?: (colIdx: number, role: ColumnRole) => void;
}

const ROLE_COLORS: Record<string, string> = {
  produs: "rgba(59, 130, 246, 0.22)",
  cantitate: "rgba(34, 197, 94, 0.22)",
  gramaj: "rgba(245, 158, 11, 0.22)",
  magazin: "rgba(168, 85, 247, 0.22)",
};

const ROLE_BORDER_COLORS: Record<string, string> = {
  produs: "rgba(59, 130, 246, 0.7)",
  cantitate: "rgba(34, 197, 94, 0.7)",
  gramaj: "rgba(245, 158, 11, 0.7)",
  magazin: "rgba(168, 85, 247, 0.7)",
};

const ROLE_LABELS_FULL: Record<string, string> = {
  produs: "🏷️ Produs",
  cantitate: "🔢 Cantitate",
  gramaj: "⚖️ Gramaj",
  magazin: "🏪 Magazin",
};

const ROLE_CYCLE: (ColumnRole)[] = [null, "produs", "cantitate", "gramaj", "magazin"];

export default function PdfPreviewOverlay({
  fileData,
  columnRoles,
  headerRow,
  rawData,
  onColumnRoleChange,
}: PdfPreviewOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  // Full column grid positions (all detected columns)
  const [colPositions, setColPositions] = useState<number[]>([]);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [activePopover, setActivePopover] = useState<{ colIdx: number; x: number; y: number } | null>(null);

  // Load PDF document
  useEffect(() => {
    const loadPdf = async () => {
      try {
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(fileData) }).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error("Failed to load PDF for preview:", err);
      }
    };
    loadPdf();
  }, [fileData]);

  // Render page + detect column positions
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPageWidth(viewport.width);
      setPageHeight(viewport.height);

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Extract text items
      const textContent = await page.getTextContent();
      const items: { x: number; endX: number; y: number; text: string }[] = [];
      for (const item of textContent.items) {
        if (!("str" in item) || !(item as any).str.trim()) continue;
        const tx = (item as any).transform[4] * scale;
        const w = (item as any).width * scale;
        const ty = viewport.height - (item as any).transform[5] * scale;
        items.push({ 
          x: tx, 
          endX: tx + (w > 0 ? w : (item as any).str.length * 4 * scale), 
          y: ty, 
          text: (item as any).str 
        });
      }

      if (items.length === 0) { setColPositions([]); return; }

      // Group items into rows by Y
      const rowsMap: Map<number, typeof items> = new Map();
      for (const it of items) {
        const cy = Math.round(it.y / (3 * scale)) * (3 * scale);
        if (!rowsMap.has(cy)) rowsMap.set(cy, []);
        rowsMap.get(cy)!.push(it);
      }

      // For each row, split into cells using gap-based splitting
      const rowCellData: { cy: number; cells: { x: number; endX: number }[] }[] = [];
      for (const [cy, rowItems] of rowsMap) {
        const sorted = [...rowItems].sort((a, b) => a.x - b.x);
        const cells: { x: number; endX: number }[] = [];
        let cur = { x: sorted[0].x, endX: sorted[0].endX };
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].x - cur.endX < 3 * scale) {
            cur.endX = Math.max(cur.endX, sorted[i].endX);
          } else {
            cells.push(cur);
            cur = { x: sorted[i].x, endX: sorted[i].endX };
          }
        }
        cells.push(cur);
        rowCellData.push({ cy, cells });
      }

      // Find the row with the MOST cells — this is almost certainly the table header
      let bestRow = rowCellData[0];
      for (const r of rowCellData) {
        if (r.cells.length > bestRow.cells.length) bestRow = r;
      }

      if (bestRow.cells.length < 2) { setColPositions([]); return; }

      // Use that row's cell start positions as column boundaries
      const positions = bestRow.cells.map(c => Math.round(c.x));

      console.log(`[PDF Preview] Best row has ${bestRow.cells.length} cells, column positions: ${positions.join(', ')}`)
      setColPositions(positions);
    };

    renderPage();
  }, [pdfDoc, pageNum, scale]);

  // Draw overlay with column highlights and hover
  useEffect(() => {
    if (!overlayRef.current || pageWidth === 0 || colPositions.length === 0) return;
    const canvas = overlayRef.current;
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, pageWidth, pageHeight);

    for (let i = 0; i < colPositions.length; i++) {
      const xStart = colPositions[i];
      const xEnd = i + 1 < colPositions.length ? colPositions[i + 1] : pageWidth;
      const colWidth = xEnd - xStart;
      const role = columnRoles.get(i);

      if (role) {
        // Fill assigned column
        ctx.fillStyle = ROLE_COLORS[role] || "rgba(100,100,100,0.1)";
        ctx.fillRect(xStart, 0, colWidth, pageHeight);

        // Border
        ctx.strokeStyle = ROLE_BORDER_COLORS[role] || "rgba(100,100,100,0.4)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(xStart, 0, colWidth, pageHeight);
        ctx.setLineDash([]);

        // Label at top
        const label = ROLE_LABELS_FULL[role] || "?";
        // Background for label
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(xStart + 2, 2, textWidth + 12, 20);
        ctx.fillStyle = ROLE_BORDER_COLORS[role] || "#666";
        ctx.font = `bold ${12}px sans-serif`;
        ctx.fillText(label, xStart + 8, 16);
      }

      // Hover highlight
      if (hoveredCol === i && !role) {
        ctx.fillStyle = "rgba(100, 100, 100, 0.08)";
        ctx.fillRect(xStart, 0, colWidth, pageHeight);
        ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(xStart, 0, colWidth, pageHeight);
        ctx.setLineDash([]);
      }
    }
  }, [colPositions, columnRoles, pageWidth, pageHeight, hoveredCol]);

  // Find column index from X position
  const getColIdxFromX = useCallback((clientX: number) => {
    if (!overlayRef.current || colPositions.length === 0) return -1;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = clientX - rect.left;

    for (let i = colPositions.length - 1; i >= 0; i--) {
      if (x >= colPositions[i]) return i;
    }
    return 0;
  }, [colPositions]);

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent) => {
    const colIdx = getColIdxFromX(e.clientX);
    setHoveredCol(colIdx >= 0 ? colIdx : null);
  }, [getColIdxFromX]);

  const handleOverlayMouseLeave = useCallback(() => {
    setHoveredCol(null);
  }, []);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (!onColumnRoleChange) return;
    const colIdx = getColIdxFromX(e.clientX);
    if (colIdx < 0) return;

    const rect = overlayRef.current!.getBoundingClientRect();
    setActivePopover({ colIdx, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [getColIdxFromX, onColumnRoleChange]);

  const handleRoleSelect = useCallback((role: ColumnRole) => {
    if (!activePopover || !onColumnRoleChange) return;
    onColumnRoleChange(activePopover.colIdx, role);
    setActivePopover(null);
  }, [activePopover, onColumnRoleChange]);

  return (
    <div className="border rounded-lg bg-muted/30 overflow-hidden">
      {/* Controls */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted border-b flex-wrap gap-1">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum <= 1} onClick={() => setPageNum((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{pageNum} / {numPages}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={pageNum >= numPages} onClick={() => setPageNum((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          👆 Click pe o coloană din PDF pentru a-i atribui rol
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2 px-2 py-1 border-b bg-muted/50 flex-wrap">
        {Object.entries(ROLE_COLORS).map(([role, color]) => (
          <span key={role} className="flex items-center gap-1 text-[10px]">
            <span className="inline-block w-3 h-3 rounded-sm border" style={{ backgroundColor: color, borderColor: ROLE_BORDER_COLORS[role] }} />
            {ROLE_LABELS_FULL[role]}
          </span>
        ))}
      </div>

      {/* Canvas container */}
      <div ref={containerRef} className="overflow-auto max-h-[55vh]" style={{ position: "relative" }}>
        <div style={{ position: "relative", width: pageWidth || "100%", height: pageHeight || "auto" }}>
          <canvas ref={canvasRef} style={{ display: "block" }} />
          <canvas
            ref={overlayRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              cursor: onColumnRoleChange ? "pointer" : "default",
            }}
            onMouseMove={handleOverlayMouseMove}
            onMouseLeave={handleOverlayMouseLeave}
            onClick={handleOverlayClick}
          />

          {/* Role picker popover */}
          {activePopover && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActivePopover(null)}
              />
              <div
                className="absolute z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[160px]"
                style={{
                  left: Math.min(activePopover.x, (pageWidth || 300) - 180),
                  top: Math.min(activePopover.y, (pageHeight || 300) - 200),
                }}
              >
                <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium">
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
                {(["produs", "cantitate", "gramaj", "magazin"] as ColumnRole[]).map(role => (
                  <button
                    key={role}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                      columnRoles.get(activePopover.colIdx) === role && "font-medium",
                      columnRoles.get(activePopover.colIdx) === role && role === "produs" && "bg-blue-500/10",
                      columnRoles.get(activePopover.colIdx) === role && role === "cantitate" && "bg-green-500/10",
                      columnRoles.get(activePopover.colIdx) === role && role === "gramaj" && "bg-amber-500/10",
                      columnRoles.get(activePopover.colIdx) === role && role === "magazin" && "bg-purple-500/10",
                    )}
                    onClick={() => handleRoleSelect(role)}
                  >
                    {ROLE_LABELS_FULL[role!]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
