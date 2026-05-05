import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, Play, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  useSabloane,
  useCreateSablon,
  useUpdateSablon,
  useDeleteSablon,
  useUpsertSablonItem,
  useDeleteSablonItem,
  type Sablon,
} from "@/hooks/productie/useSabloane";
import {
  useProducts,
  useProductionLines,
  useCreateOrder,
} from "@/hooks/productie/useProductionData";
import DateProductiePicker, { todayISO } from "./DateProductiePicker";

const SabloaneProductieAvans = ({ onGenerated }: { onGenerated?: () => void }) => {
  const { data: sabloane = [], isLoading } = useSabloane();
  const { data: products = [] } = useProducts();
  const { data: lines = [] } = useProductionLines();
  const createSablon = useCreateSablon();
  const updateSablon = useUpdateSablon();
  const deleteSablon = useDeleteSablon();
  const upsertItem = useUpsertSablonItem();
  const deleteItem = useDeleteSablonItem();
  const createOrder = useCreateOrder();

  // dialoguri
  const [createOpen, setCreateOpen] = useState(false);
  const [editSablon, setEditSablon] = useState<Sablon | null>(null);
  const [generateSablon, setGenerateSablon] = useState<Sablon | null>(null);

  // form create sablon
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Numele șablonului este obligatoriu");
      return;
    }
    try {
      await createSablon.mutateAsync({ nume: newName.trim(), descriere: newDesc.trim() || undefined });
      toast.success("Șablon creat");
      setNewName("");
      setNewDesc("");
      setCreateOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Eroare la creare");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Șabloane Producție Avans</h3>
          <p className="text-sm text-muted-foreground">
            Creează liste predefinite (ex: Aromate) și generează rapid comenzi pentru o anumită zi.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" /> Șablon nou
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sabloane.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nu există șabloane. Creează primul șablon pentru a genera rapid comenzi.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sabloane.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-blue-600" />
                  {s.nume}
                </CardTitle>
                {s.descriere && (
                  <p className="text-xs text-muted-foreground">{s.descriere}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  {s.productie_sabloane_items?.length || 0} produse în șablon
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={(s.productie_sabloane_items?.length || 0) === 0}
                    onClick={() => setGenerateSablon(s)}
                  >
                    <Play className="h-3 w-3 mr-1" /> Generează comenzi
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditSablon(s)}>
                    <Edit className="h-3 w-3 mr-1" /> Editează
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      if (!window.confirm(`Ștergi șablonul "${s.nume}"?`)) return;
                      try {
                        await deleteSablon.mutateAsync(s.id);
                        toast.success("Șablon șters");
                      } catch (e: any) {
                        toast.error(e.message);
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog creare */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Șablon nou</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nume șablon *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Aromate" />
            </div>
            <div>
              <Label>Descriere (opțional)</Label>
              <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Anulează</Button>
              <Button onClick={handleCreate} disabled={createSablon.isPending}>
                {createSablon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Creează"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog editare items */}
      {editSablon && (
        <SablonEditDialog
          sablon={editSablon}
          products={products}
          lines={lines}
          onClose={() => setEditSablon(null)}
          onUpsertItem={(item) => upsertItem.mutateAsync(item)}
          onDeleteItem={(id) => deleteItem.mutateAsync(id)}
          onRename={async (nume, descriere) => {
            await updateSablon.mutateAsync({ id: editSablon.id, nume, descriere });
          }}
        />
      )}

      {/* Dialog generare comenzi */}
      {generateSablon && (
        <GenerateOrdersDialog
          sablon={generateSablon}
          onClose={() => setGenerateSablon(null)}
          onGenerate={async (rows, dataProductie) => {
            let count = 0;
            for (const r of rows) {
              if (!r.cantitate || r.cantitate <= 0) continue;
              await createOrder.mutateAsync({
                magazin: "PRODUCTIE_AVANS",
                punct_livrare: "PRODUCTIE_AVANS",
                produs_id: r.produs_id,
                cantitate: r.cantitate,
                baxare: r.observatie || undefined,
                linie_id: r.linie_id || null,
                status: "pending",
                tip_comanda: "PRODUCTIE_AVANS",
                data_productie: dataProductie || null,
              });
              count++;
              // salvează observația ca "ultima folosită" pe item
              await upsertItem.mutateAsync({
                id: r.item_id,
                sablon_id: generateSablon.id,
                produs_id: r.produs_id,
                observatie_default: r.observatie || null,
                cantitate_default: r.cantitate,
                linie_id: r.linie_id || null,
                pozitie: r.pozitie,
              });
            }
            toast.success(`${count} comenzi generate cu succes`);
            setGenerateSablon(null);
            onGenerated?.();
          }}
        />
      )}
    </div>
  );
};

// ============= EDIT DIALOG =============
interface SablonEditDialogProps {
  sablon: Sablon;
  products: any[];
  lines: any[];
  onClose: () => void;
  onUpsertItem: (item: any) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onRename: (nume: string, descriere?: string) => Promise<void>;
}

const SablonEditDialog = ({ sablon, products, lines, onClose, onUpsertItem, onDeleteItem, onRename }: SablonEditDialogProps) => {
  const [nume, setNume] = useState(sablon.nume);
  const [descriere, setDescriere] = useState(sablon.descriere || "");
  const [addProdusId, setAddProdusId] = useState("");
  const items = sablon.productie_sabloane_items || [];

  const productMap = useMemo(() => {
    const m = new Map<string, any>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const usedIds = new Set(items.map((i) => i.produs_id));
  const availableProducts = products.filter((p) => !usedIds.has(p.id));

  const handleAdd = async () => {
    if (!addProdusId) return;
    try {
      await onUpsertItem({
        sablon_id: sablon.id,
        produs_id: addProdusId,
        pozitie: items.length,
      });
      setAddProdusId("");
      toast.success("Produs adăugat");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editare șablon: {sablon.nume}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nume</Label>
              <Input value={nume} onChange={(e) => setNume(e.target.value)} onBlur={() => onRename(nume, descriere)} />
            </div>
            <div>
              <Label>Descriere</Label>
              <Input value={descriere} onChange={(e) => setDescriere(e.target.value)} onBlur={() => onRename(nume, descriere)} />
            </div>
          </div>

          <div className="border rounded-lg p-3 bg-muted/30">
            <Label className="text-sm">Adaugă produs în șablon</Label>
            <div className="flex gap-2 mt-1">
              <Select value={addProdusId} onValueChange={setAddProdusId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selectează produs..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nume} ({p.unitate_masura})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={!addProdusId}>
                <Plus className="h-4 w-4 mr-1" /> Adaugă
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Produs</TableHead>
                <TableHead className="w-32">Cant. implicită</TableHead>
                <TableHead>Observație implicită</TableHead>
                <TableHead className="w-44">Linie preferată</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => {
                const prod = productMap.get(it.produs_id) || it.productie_produse;
                return (
                  <SablonItemRow
                    key={it.id}
                    item={it}
                    idx={idx}
                    productNume={prod?.nume || "Necunoscut"}
                    unit={prod?.unitate_masura || ""}
                    lines={lines}
                    onSave={(updates) =>
                      onUpsertItem({
                        id: it.id,
                        sablon_id: sablon.id,
                        produs_id: it.produs_id,
                        ...updates,
                      })
                    }
                    onDelete={() => onDeleteItem(it.id)}
                  />
                );
              })}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Niciun produs în șablon. Adaugă mai sus.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Închide</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SablonItemRow = ({
  item,
  idx,
  productNume,
  unit,
  lines,
  onSave,
  onDelete,
}: any) => {
  const [obs, setObs] = useState(item.observatie_default || "");
  const [cant, setCant] = useState<string>(item.cantitate_default?.toString() || "");
  const [linieId, setLinieId] = useState<string>(item.linie_id || "none");

  const flush = () => {
    onSave({
      observatie_default: obs || null,
      cantitate_default: cant ? Number(cant) : null,
      linie_id: linieId === "none" ? null : linieId,
      pozitie: item.pozitie,
    });
  };

  return (
    <TableRow>
      <TableCell>{idx + 1}</TableCell>
      <TableCell className="font-medium">{productNume} <span className="text-xs text-muted-foreground">({unit})</span></TableCell>
      <TableCell>
        <Input
          type="number"
          value={cant}
          onChange={(e) => setCant(e.target.value)}
          onBlur={flush}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input value={obs} onChange={(e) => setObs(e.target.value)} onBlur={flush} className="h-8" placeholder="Ex: prioritate mare" />
      </TableCell>
      <TableCell>
        <Select value={linieId} onValueChange={(v) => { setLinieId(v); setTimeout(flush, 0); }}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Auto-distribuire</SelectItem>
            {lines.filter((l: any) => l.status === "activa").map((l: any) => (
              <SelectItem key={l.id} value={l.id}>{l.nume}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </TableCell>
    </TableRow>
  );
};

// ============= GENERATE ORDERS DIALOG =============
interface GenerateRow {
  item_id: string;
  produs_id: string;
  nume: string;
  unit: string;
  cantitate: number;
  observatie: string;
  linie_id: string | null;
  pozitie: number;
}

const GenerateOrdersDialog = ({
  sablon,
  onClose,
  onGenerate,
}: {
  sablon: Sablon;
  onClose: () => void;
  onGenerate: (rows: GenerateRow[], dataProductie: string) => Promise<void>;
}) => {
  const [dataProductie, setDataProductie] = useState<string>(todayISO());
  const [rows, setRows] = useState<GenerateRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const items = sablon.productie_sabloane_items || [];
    setRows(
      items.map((it) => ({
        item_id: it.id,
        produs_id: it.produs_id,
        nume: it.productie_produse?.nume || "Necunoscut",
        unit: it.productie_produse?.unitate_masura || "",
        cantitate: it.cantitate_default || 0,
        observatie: it.observatie_default || "",
        linie_id: it.linie_id,
        pozitie: it.pozitie,
      }))
    );
  }, [sablon]);

  const update = (i: number, patch: Partial<GenerateRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const totalActive = rows.filter((r) => r.cantitate > 0).length;

  const handleGenerate = async () => {
    if (totalActive === 0) {
      toast.error("Setează cantitatea pentru cel puțin un produs");
      return;
    }
    setSubmitting(true);
    try {
      await onGenerate(rows, dataProductie);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generează comenzi din șablonul: {sablon.nume}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <DateProductiePicker value={dataProductie} onChange={setDataProductie} />

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produs</TableHead>
                <TableHead className="w-28">Cantitate</TableHead>
                <TableHead>Observație</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.item_id} className={r.cantitate > 0 ? "" : "opacity-60"}>
                  <TableCell className="font-medium">
                    {r.nume} <span className="text-xs text-muted-foreground">({r.unit})</span>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={r.cantitate || ""}
                      onChange={(e) => update(i, { cantitate: Number(e.target.value) || 0 })}
                      className="h-8"
                      placeholder="0"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={r.observatie}
                      onChange={(e) => update(i, { observatie: e.target.value })}
                      className="h-8"
                      placeholder="(folosește ultima observație)"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-sm text-muted-foreground">
              {totalActive} produse vor genera comenzi (cantitate &gt; 0)
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Anulează</Button>
              <Button onClick={handleGenerate} disabled={submitting || totalActive === 0} className="bg-green-600 hover:bg-green-700">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                Generează {totalActive} comenzi
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SabloaneProductieAvans;
