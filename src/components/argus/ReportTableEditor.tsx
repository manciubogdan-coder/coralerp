import { useEffect, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, RotateCcw, Save, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { displayedTable, moveItem, tableDraft, tableSource, type ReportTable, type ReportView, type TableEdit } from "@/lib/argus/reportTables";

function Handle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({ id });
  return <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0 touch-none" title="Trage pentru reordonare" aria-label={`Reordonează ${id}`} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></Button>;
}
function SortableCell({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <th ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`min-w-44 border-b border-r bg-muted p-2 ${isDragging ? "opacity-50" : ""}`}>{children}</th>;
}
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-50" : ""}>{children}</tr>;
}

export default function ReportTableEditor({ open, onOpenChange, tables, view, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; tables: ReportTable[]; view?: ReportView | null; onSave: (v: ReportView | null) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, TableEdit>>({});
  const [active, setActive] = useState("");
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => {
    if (!open) return;
    setActive(tables[0]?.id ?? "");
    setDrafts(Object.fromEntries(tables.map(t => {
      const previous = view?.tables?.[t.id];
      if (previous?.source === tableSource(t)) return [t.id, structuredClone(previous)];
      const shown = displayedTable(t, previous);
      const draft = tableDraft(shown);
      draft.source = tableSource(t); draft.originalHeaders = [...t.headers];
      draft.columnIds = shown.headers.map((_, i) => previous?.columnIds?.[i] ?? i);
      return [t.id, draft];
    })));
  }, [open]); // Opening hydrates once; edits survive parent updates.
  const d = drafts[active];
  const update = (patch: Partial<TableEdit>) => setDrafts(s => ({ ...s, [active]: { ...s[active], ...patch } }));
  const reorder = ({ active: a, over }: DragEndEvent) => {
    if (!d || !over || a.id === over.id) return;
    const [kind, raw] = String(a.id).split(":");
    if (!String(over.id).startsWith(`${kind}:`)) return;
    const from = Number(raw), to = Number(String(over.id).split(":")[1]);
    if (kind === "c") update({ headers: moveItem(d.headers, from, to), columnIds: moveItem(d.columnIds, from, to), rows: d.rows.map(r => moveItem(r, from, to)) });
    else update({ rows: moveItem(d.rows, from, to) });
  };
  const save = async (reset = false) => {
    setSaving(true);
    try { await onSave(reset ? null : { tables: drafts }); onOpenChange(false); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[90vh] max-w-6xl flex-col">
    <DialogHeader><DialogTitle>Editează tabelul</DialogTitle></DialogHeader>
    <p className="text-xs text-muted-foreground">Modificări personale, fără schimbarea datelor Senior. Actualizarea raportului înlocuiește valorile manuale cu cele noi.</p>
    {tables.length > 1 && <Tabs value={active} onValueChange={setActive}><TabsList className="flex h-auto flex-wrap justify-start">{tables.map((t, i) => <TabsTrigger key={t.id} value={t.id}>{i + 1}. {t.title.slice(0, 35)}</TabsTrigger>)}</TabsList></Tabs>}
    {d && <><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={saving} onClick={() => update({ headers: [...d.headers, "Coloană nouă"], columnIds: [...d.columnIds, Math.min(-1, ...d.columnIds) - 1], rows: d.rows.map(r => [...r, ""]) })}><Plus className="mr-1 h-4 w-4" />Coloană</Button><Button variant="outline" size="sm" disabled={saving} onClick={() => update({ rows: [...d.rows, d.headers.map(() => "")] })}><Plus className="mr-1 h-4 w-4" />Rând</Button></div>
      <div className="min-h-0 flex-1 overflow-auto rounded border"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorder}><table className="w-full text-sm"><thead><tr><th className="bg-muted" /><SortableContext items={d.headers.map((_, i) => `c:${i}`)} strategy={horizontalListSortingStrategy}>{d.headers.map((h, i) => <SortableCell id={`c:${i}`} key={i}><div className="flex items-center gap-1"><Handle id={`c:${i}`} /><Input aria-label={`Titlu coloană ${i + 1}`} value={h} onChange={e => update({ headers: d.headers.map((v, j) => j === i ? e.target.value : v) })} /><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`Șterge coloana ${i + 1}`} disabled={d.headers.length === 1} onClick={() => update({ headers: d.headers.filter((_, j) => j !== i), columnIds: d.columnIds.filter((_, j) => j !== i), rows: d.rows.map(r => r.filter((_, j) => j !== i)) })}><Trash2 className="h-3.5 w-3.5" /></Button></div></SortableCell>)}</SortableContext></tr></thead>
      <tbody><SortableContext items={d.rows.map((_, i) => `r:${i}`)} strategy={verticalListSortingStrategy}>{d.rows.map((r, i) => <SortableRow id={`r:${i}`} key={i}><td className="border-b p-1"><div className="flex items-center"><Handle id={`r:${i}`} /><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Șterge rândul ${i + 1}`} onClick={() => update({ rows: d.rows.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></Button></div></td>{d.headers.map((_, j) => <td className="border-b border-r p-1" key={j}><Input aria-label={`Rând ${i + 1}, coloană ${j + 1}`} value={String(r[j] ?? "")} onChange={e => update({ rows: d.rows.map((row, k) => k === i ? d.headers.map((_, l) => l === j ? e.target.value : row[l]) : row) })} /></td>)}</SortableRow>)}</SortableContext></tbody></table></DndContext></div></>}
    <DialogFooter className="gap-2"><Button variant="outline" disabled={saving} onClick={() => save(true)}><RotateCcw className="mr-1 h-4 w-4" />Revino la original</Button><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Anulează</Button><Button disabled={saving || !d} onClick={() => save()}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Salvează tabelul</Button></DialogFooter>
  </DialogContent></Dialog>;
}