import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Printer, ArrowRightLeft, CornerDownLeft } from "lucide-react";
import { ForceInventoryType, type InventoryType } from "@/context/inventory-type";
import { LotQRDialog } from "@/components/inventory/LotQRDialog";
import { TransferReturnForm } from "@/components/inventory/TransferReturnForm";

type LotInfo = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  lot_number?: string | null;
  receipt_date?: string | null;
  entry_number?: number | null;
  document_number?: string | null;
  supplier_name?: string | null;
  manufacturer_name?: string | null;
  inventory_type: InventoryType;
};

type ActiveTransfer = {
  transfer_id: string;
  transfer_date: string;
  destination: string;
  product_name: string;
  supplier_name?: string;
  manufacturer_name?: string;
  document_number?: string;
  entry_number?: number;
  quantity: number;
  unit: string;
  notes?: string;
  inventory_item_id: string;
  created_at?: string;
  lot_number?: string;
};

const TYPE_LABEL: Record<InventoryType, string> = {
  "materii-prime": "Materii Prime",
  ambalaje: "Ambalaje",
  etichete: "Etichete",
};
const TYPE_PATH: Record<InventoryType, string> = {
  "materii-prime": "/depozit-mp",
  ambalaje: "/depozit-ambalaje",
  etichete: "/etichete",
};

const TYPE_TABLES: { type: InventoryType; inv: string; transfers: string }[] = [
  { type: "materii-prime", inv: "inventory", transfers: "stock_transfer_items" },
  { type: "ambalaje", inv: "ambalaje_inventory", transfers: "ambalaje_stock_transfer_items" },
  { type: "etichete", inv: "etichete_inventory", transfers: "etichete_stock_transfer_items" },
];

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("ro-RO"); } catch { return d; }
};

const LotDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<LotInfo | null>(null);
  const [transfers, setTransfers] = useState<ActiveTransfer[]>([]);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setInfo(null);
      setTransfers([]);

      for (const t of TYPE_TABLES) {
        const { data: row } = await (supabase as any)
          .from(t.inv)
          .select(`
            id, name, quantity, unit, lot_number, receipt_date, entry_number, document_number,
            suppliers:supplier_id(name),
            manufacturers:manufacturer_id(name)
          `)
          .eq("id", id)
          .maybeSingle();
        if (cancelled) return;
        if (row) {
          setInfo({
            id: row.id,
            name: row.name,
            quantity: Number(row.quantity || 0),
            unit: row.unit || "",
            lot_number: row.lot_number,
            receipt_date: row.receipt_date,
            entry_number: row.entry_number,
            document_number: row.document_number,
            supplier_name: row.suppliers?.name || null,
            manufacturer_name: row.manufacturers?.name || null,
            inventory_type: t.type,
          });

          // Fetch transfers for this item
          const { data: tr } = await (supabase as any)
            .from(t.transfers)
            .select(`
              *,
              stock_transfers:transfer_id ( transfer_date, destination, notes, created_at )
            `)
            .eq("inventory_item_id", id)
            .order("created_at", { ascending: false });
          if (cancelled) return;
          const list: ActiveTransfer[] = (tr || []).map((it: any) => ({
            transfer_id: it.transfer_id,
            transfer_date: it.stock_transfers?.transfer_date || "",
            destination: it.stock_transfers?.destination || "",
            product_name: row.name,
            supplier_name: row.suppliers?.name || "",
            manufacturer_name: row.manufacturers?.name || "",
            document_number: row.document_number || "",
            entry_number: row.entry_number || 0,
            quantity: Number(it.quantity || 0),
            unit: it.unit || row.unit,
            notes: it.stock_transfers?.notes || "",
            inventory_item_id: it.inventory_item_id,
            created_at: it.stock_transfers?.created_at || it.created_at,
            lot_number: row.lot_number || "",
          }));
          setTransfers(list);
          setLoading(false);
          return;
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const openTransferForm = () => {
    if (!info) return;
    navigate(TYPE_PATH[info.inventory_type]);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("open-transfer-form", {
          detail: { inventoryItemId: info.id },
        })
      );
    }, 400);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Se încarcă lotul…
      </div>
    );
  }

  if (!info) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <h2 className="text-xl font-semibold">Lot inexistent</h2>
        <p className="text-muted-foreground">QR-ul nu corespunde unui lot din sistem (id: {id}).</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Înapoi
        </Button>
      </div>
    );
  }

  return (
    <ForceInventoryType type={info.inventory_type}>
      <div className="max-w-2xl mx-auto py-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Înapoi
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-2xl">{info.name}</CardTitle>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{TYPE_LABEL[info.inventory_type]}</Badge>
                  {info.lot_number && <Badge variant="outline">Lot: {info.lot_number}</Badge>}
                  {info.entry_number ? <Badge variant="outline">#{info.entry_number}</Badge> : null}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Stoc curent</div>
                <div className="text-3xl font-bold tabular-nums">
                  {info.quantity.toLocaleString("ro-RO", { maximumFractionDigits: 2 })}
                  <span className="text-base font-medium text-muted-foreground ml-1">{info.unit}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <div className="text-muted-foreground">Furnizor</div>
              <div className="font-medium">{info.supplier_name || "—"}</div>
              <div className="text-muted-foreground">Producător</div>
              <div className="font-medium">{info.manufacturer_name || "—"}</div>
              <div className="text-muted-foreground">Document</div>
              <div className="font-medium">{info.document_number || "—"}</div>
              <div className="text-muted-foreground">Data recepție</div>
              <div className="font-medium">{formatDate(info.receipt_date)}</div>
            </div>

            <div className="pt-4 flex flex-wrap gap-2">
              <Button onClick={openTransferForm}>
                <ArrowRightLeft className="h-4 w-4 mr-2" /> Bon de transfer
              </Button>
              <Button variant="outline" onClick={() => setQrOpen(true)}>
                <Printer className="h-4 w-4 mr-2" /> Reprintează QR
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Transferuri pentru acest lot</CardTitle>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Nu există transferuri pentru acest lot. Poți emite unul cu butonul de mai sus.
              </div>
            ) : (
              <div className="space-y-3">
                {transfers.map((t) => (
                  <div
                    key={`${t.transfer_id}-${t.created_at}`}
                    className="flex items-center justify-between gap-3 border rounded-md p-3 flex-wrap"
                  >
                    <div className="text-sm">
                      <div className="font-medium">
                        {t.destination || "—"}
                        <span className="text-muted-foreground font-normal ml-2">
                          {formatDate(t.transfer_date || t.created_at)}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        Cantitate transferată: {t.quantity.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {t.unit}
                      </div>
                      {t.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>
                      )}
                    </div>
                    <TransferReturnForm transfer={t as any} onReturnComplete={() => {
                      // refresh
                      window.location.reload();
                    }} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <LotQRDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          inventoryId={info.id}
          inventoryType={info.inventory_type}
        />
      </div>
    </ForceInventoryType>
  );
};

export default LotDetailPage;
