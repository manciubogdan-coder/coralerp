import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";
import { type Prereceptie, type PrereceptieLinie, STATUS_LABEL, breakdownText, fetchPrereceptii } from "@/lib/prereceptie";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  inventoryType: string;
  onPick: (line: PrereceptieLinie, header: { document_number: string; supplier_id: string | null }) => void;
}

export const PrereceptiePicker: React.FC<Props> = ({ open, onOpenChange, inventoryType, onPick }) => {
  const [list, setList] = useState<Prereceptie[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    setSelected(null);
    setLoading(true);
    setList([]);
    setError(null);
    fetchPrereceptii(inventoryType, true, controller.signal)
      .then((rows) => { if (active) setList(rows); })
      .catch(() => { if (active) setError("Prerecepțiile nu au putut fi încărcate. Serviciul de date nu răspunde momentan."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [open, inventoryType, attempt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Alege comanda din prerecepție</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="py-6 space-y-3 text-center" role="alert">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />Reîncearcă
            </Button>
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nu există prerecepții deschise.</p>
        ) : (
          <div className="space-y-2">
            {list.map((p) => (
              <div key={p.id} className="border rounded-lg">
                <button
                  type="button"
                  className="w-full text-left p-3 flex flex-wrap items-center gap-2"
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                >
                  <input type="checkbox" readOnly checked={selected === p.id} />
                  <span className="font-semibold">{p.supplier_name}</span>
                  <span className="text-sm text-muted-foreground">Doc. {p.document_number}</span>
                  {p.expected_date && <span className="text-sm text-muted-foreground">· {new Date(p.expected_date).toLocaleDateString("ro-RO")}</span>}
                  <Badge variant="outline">{STATUS_LABEL[p.status] || p.status}</Badge>
                </button>
                {selected === p.id && (
                  <div className="border-t p-2 space-y-1">
                    <div className="text-xs text-muted-foreground px-1">Alege produsul pe care îl recepționezi acum:</div>
                    {p.linii.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted">
                        <div className="text-sm">
                          <div className="font-medium">{l.product_name}{l.manufacturer_name ? ` · ${l.manufacturer_name}` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {Number(l.cantitate_document).toLocaleString("ro-RO")} {l.unit}
                            {breakdownText(l.pallets) && ` · ${breakdownText(l.pallets)} paleți`}
                            {breakdownText(l.crates) && ` · ${breakdownText(l.crates)} lăzi`}
                          </div>
                        </div>
                        {l.received_at ? (
                          <Badge>Recepționat {Number(l.received_quantity).toLocaleString("ro-RO")}</Badge>
                        ) : (
                          <Button size="sm" onClick={() => onPick(l, { document_number: p.document_number, supplier_id: p.supplier_id })}>
                            Recepționează
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
