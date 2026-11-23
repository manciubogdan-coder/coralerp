import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PackageX } from "lucide-react";
import { toast } from "@/hooks/use-custom-toast";
import { markLineMissing } from "@/lib/prereceptie";

export interface MissingTarget {
  prereceptieId: string;
  documentNumber: string;
  supplierName: string | null;
  lines: { id: string; product_name: string; cantitate_document: number; unit: string | null }[];
}

interface Props {
  target: MissingTarget | null;
  onClose: () => void;
  onDone: () => void;
}

/** Confirms that goods on the documents never arrived; the lines close the pre-reception as "lipsă marfă". */
export const MissingGoodsDialog: React.FC<Props> = ({ target, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (target) setReason(""); }, [target]);

  const save = async () => {
    if (!target) return;
    setSaving(true);
    try {
      for (const l of target.lines) await markLineMissing(l.id, target.prereceptieId, reason);
      toast({ title: "Lipsă marfă înregistrată", description: `${target.lines.length} produs(e) din doc. ${target.documentNumber}` });
      onDone();
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lipsa nu a fost salvată", description: e?.message || String(e) });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackageX className="h-5 w-5 text-destructive" />Marfa nu a venit</DialogTitle>
          <DialogDescription>
            {target?.supplierName} · Doc. {target?.documentNumber}. Produsele rămân pe document ca lipsă și apar în Istoric recepții.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <ul className="rounded-md border divide-y text-sm">
            {target?.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 px-3 py-2">
                <span className="font-medium">{l.product_name}</span>
                <span className="text-destructive whitespace-nowrap">{Number(l.cantitate_document).toLocaleString("ro-RO")} {l.unit || ""}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1">
            <label className="text-sm font-medium">Motiv (opțional)</label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex. nu a fost încărcată în camion" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Renunță</Button>
          <Button variant="destructive" onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirmă lipsa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
