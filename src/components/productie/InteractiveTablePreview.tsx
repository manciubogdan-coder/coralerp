import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type ColumnRole = "produs" | "cantitate" | "gramaj" | "magazin" | null;

const ROLE_COLORS: Record<string, string> = {
  produs: "bg-blue-500/15 border-blue-400",
  cantitate: "bg-green-500/15 border-green-400",
  gramaj: "bg-amber-500/15 border-amber-400",
  magazin: "bg-purple-500/15 border-purple-400",
};

const ROLE_HEADER_COLORS: Record<string, string> = {
  produs: "bg-blue-500/30 text-blue-900 dark:text-blue-200",
  cantitate: "bg-green-500/30 text-green-900 dark:text-green-200",
  gramaj: "bg-amber-500/30 text-amber-900 dark:text-amber-200",
  magazin: "bg-purple-500/30 text-purple-900 dark:text-purple-200",
};

const ROLE_LABELS: Record<string, string> = {
  produs: "🏷️ Produs",
  cantitate: "🔢 Cantitate",
  gramaj: "⚖️ Gramaj",
  magazin: "🏪 Magazin",
};

const ROLE_CYCLE: ColumnRole[] = [null, "produs", "cantitate", "gramaj", "magazin"];

interface InteractiveTablePreviewProps {
  rawData: any[][];
  headerRow: number;
  columnRoles: Map<number, ColumnRole>;
  onColumnRoleChange?: (colIdx: number, role: ColumnRole) => void;
  onCellClick?: (rowIdx: number, colIdx: number) => void;
  cellSelections?: Map<string, string>;
  maxRows?: number;
}

export default function InteractiveTablePreview({
  rawData,
  headerRow,
  columnRoles,
  onColumnRoleChange,
  onCellClick,
  cellSelections = new Map(),
  maxRows = 50,
}: InteractiveTablePreviewProps) {
  const [activePopover, setActivePopover] = useState<{ colIdx: number } | null>(null);

  const maxCols = useMemo(
    () => rawData.reduce((max, row) => Math.max(max, row?.length || 0), 0),
    [rawData]
  );

  const displayRows = useMemo(
    () => rawData.slice(0, maxRows),
    [rawData, maxRows]
  );

  const handleHeaderClick = useCallback(
    (colIdx: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!onColumnRoleChange) return;
      setActivePopover((prev) => (prev?.colIdx === colIdx ? null : { colIdx }));
    },
    [onColumnRoleChange]
  );

  const handleRoleSelect = useCallback(
    (colIdx: number, role: ColumnRole) => {
      onColumnRoleChange?.(colIdx, role);
      setActivePopover(null);
    },
    [onColumnRoleChange]
  );

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      {/* Legend */}
      <div className="flex gap-3 px-3 py-1.5 border-b bg-muted/50 flex-wrap items-center">
        <span className="text-[10px] text-muted-foreground font-medium">👆 Click pe antetul coloanei pentru a-i atribui un rol:</span>
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <span key={role} className="flex items-center gap-1 text-[10px]">
            <span
              className={cn("inline-block w-3 h-3 rounded-sm border", ROLE_COLORS[role])}
            />
            {label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[55vh]">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="bg-muted px-1.5 py-2 text-[10px] text-muted-foreground w-10 border-r border-b font-mono">
                #
              </th>
              {Array.from({ length: maxCols }, (_, colIdx) => {
                const role = columnRoles.get(colIdx);
                const headerVal = rawData[headerRow]?.[colIdx];
                const headerText = headerVal != null ? String(headerVal).trim() : "";
                const isActive = activePopover?.colIdx === colIdx;

                return (
                  <th
                    key={colIdx}
                    className={cn(
                      "px-2 py-1.5 border-r border-b min-w-[70px] cursor-pointer transition-all relative select-none",
                      role ? ROLE_HEADER_COLORS[role] : "bg-muted hover:bg-accent",
                      isActive && "ring-2 ring-primary ring-inset"
                    )}
                    onClick={(e) => handleHeaderClick(colIdx, e)}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {role && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] py-0 px-1.5 font-semibold border",
                            ROLE_COLORS[role]
                          )}
                        >
                          {ROLE_LABELS[role]}
                        </Badge>
                      )}
                      <span className={cn("text-[11px] truncate max-w-[120px]", role ? "font-bold" : "font-medium text-muted-foreground")}>
                        {headerText || `Col ${colIdx + 1}`}
                      </span>
                    </div>

                    {/* Role picker popover */}
                    {isActive && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivePopover(null);
                          }}
                        />
                        <div
                          className="absolute top-full left-1/2 -translate-x-1/2 z-50 bg-popover border rounded-lg shadow-xl p-1 min-w-[150px] mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <p className="text-[10px] text-muted-foreground px-2 py-1 font-medium border-b mb-1">
                            Coloana {colIdx + 1}
                          </p>
                          <button
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                              !role && "bg-accent font-medium"
                            )}
                            onClick={() => handleRoleSelect(colIdx, null)}
                          >
                            ❌ Fără rol
                          </button>
                          {(["produs", "cantitate", "gramaj", "magazin"] as ColumnRole[]).map(
                            (r) => (
                              <button
                                key={r}
                                className={cn(
                                  "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2",
                                  role === r && "font-semibold",
                                  role === r && ROLE_COLORS[r!]
                                )}
                                onClick={() => handleRoleSelect(colIdx, r)}
                              >
                                {ROLE_LABELS[r!]}
                              </button>
                            )
                          )}
                        </div>
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, rowIdx) => {
              const isHeader = rowIdx === headerRow;
              const isAboveHeader = rowIdx < headerRow;

              return (
                <tr
                  key={rowIdx}
                  className={cn(
                    "border-b transition-colors",
                    isHeader && "bg-primary/10 font-semibold",
                    isAboveHeader && "opacity-40",
                    !isHeader && !isAboveHeader && "hover:bg-accent/30"
                  )}
                >
                  <td className="px-1.5 py-0.5 text-[10px] text-muted-foreground border-r text-center font-mono">
                    {rowIdx}
                    {isHeader && (
                      <span className="ml-0.5 text-[8px] text-primary font-bold">
                        HDR
                      </span>
                    )}
                  </td>
                  {Array.from({ length: maxCols }, (_, colIdx) => {
                    const role = columnRoles.get(colIdx);
                    const cellKey = `${rowIdx}:${colIdx}`;
                    const isCellSelected = cellSelections.has(cellKey);
                    const cellVal = row?.[colIdx] != null ? String(row[colIdx]) : "";

                    return (
                      <td
                        key={colIdx}
                        onClick={() => onCellClick?.(rowIdx, colIdx)}
                        className={cn(
                          "px-1.5 py-0.5 border-r text-[11px] truncate max-w-[160px] cursor-pointer transition-colors",
                          role === "produs" && "bg-blue-500/5",
                          role === "cantitate" && "bg-green-500/5",
                          role === "gramaj" && "bg-amber-500/5",
                          role === "magazin" && "bg-purple-500/5",
                          isCellSelected && "ring-2 ring-primary bg-primary/20 font-bold",
                          !role && "hover:bg-accent/50"
                        )}
                        title={cellVal}
                      >
                        {isCellSelected && (
                          <span className="text-[8px] text-primary mr-0.5">🏪</span>
                        )}
                        {cellVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
