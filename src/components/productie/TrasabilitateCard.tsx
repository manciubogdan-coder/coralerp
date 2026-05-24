import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { QrCode, ScanLine, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import RawQRScannerDialog from "./RawQRScannerDialog";

interface TipResursa {
  key: string;
  label: string;
  group: "materie_prima" | "ambalaje" | "etichete";
}

const TIPURI: TipResursa[] = [
  { key: "materie_prima", label: "Materie primă", group: "materie_prima" },
  { key: "folie", label: "Folie", group: "ambalaje" },
  { key: "caserole", label: "Caserole", group: "ambalaje" },
  { key: "cutii", label: "Cutii", group: "ambalaje" },
  { key: "eticheta_produs", label: "Etichete produs", group: "etichete" },
  { key: "eticheta_bax", label: "Etichete bax", group: "etichete" },
];

interface ScanRow {
  id: string;
  tip: string;
  cod: string;
  scanned_at: string;
}

interface Props {
  comandaId: string;
  sesiuneId?: string | null;
}

const TrasabilitateCard: React.FC<Props> = ({ comandaId, sesiuneId }) => {
  const { user } = useAuth();
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [scanTarget, setScanTarget] = useState<string | null>(null);

  const fetchScans = async () => {
    if (!comandaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("productie_trasabilitate" as any)
      .select("id,tip,cod,scanned_at")
      .eq("comanda_id", comandaId)
      .order("scanned_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("trasabilitate fetch:", error);
      return;
    }
    setScans((data as any) || []);
  };

  useEffect(() => {
    fetchScans();
  }, [comandaId]);

  const addScan = async (tip: string, cod: string) => {
    const trimmed = cod.trim();
    if (!trimmed) return;
    setSavingKey(tip);
    const { error } = await supabase.from("productie_trasabilitate" as any).insert({
      comanda_id: comandaId,
      sesiune_id: sesiuneId || null,
      tip,
      cod: trimmed,
      scanned_by: user?.id || null,
    });
    setSavingKey(null);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    setInputs((p) => ({ ...p, [tip]: "" }));
    toast({ title: "Cod salvat", description: `${trimmed} adăugat pentru trasabilitate.` });
    fetchScans();
  };

  const removeScan = async (id: string) => {
    const { error } = await supabase
      .from("productie_trasabilitate" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      return;
    }
    fetchScans();
  };

  return (
    <Card className="border-coral-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-coral-primary to-bio-primary text-white">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-5 w-5" />
          Trasabilitate (opțional)
          <span className="text-xs font-normal text-white/80 ml-2">
            — în viitor va fi obligatorie înainte de pornirea sesiunii
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {TIPURI.map((t) => {
          const existente = scans.filter((s) => s.tip === t.key);
          const value = inputs[t.key] ?? "";
          return (
            <div key={t.key} className="border rounded-md p-3 bg-gray-50/50">
              <Label className="text-coral-primary font-medium text-sm">{t.label}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={value}
                  onChange={(e) => setInputs((p) => ({ ...p, [t.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addScan(t.key, value);
                    }
                  }}
                  placeholder="Scanează sau introdu codul..."
                  className="border-coral-200 focus:border-coral-primary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setScanTarget(t.key)}
                  title="Scanează cu camera"
                >
                  <ScanLine className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={() => addScan(t.key, value)}
                  disabled={!value.trim() || savingKey === t.key}
                  className="bg-coral-primary hover:bg-coral-600 text-white"
                >
                  {savingKey === t.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Adaugă"
                  )}
                </Button>
              </div>
              {existente.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {existente.map((s) => (
                    <Badge
                      key={s.id}
                      variant="outline"
                      className="bg-green-50 border-green-200 text-green-700 gap-1 pr-1"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {s.cod}
                      <button
                        onClick={() => removeScan(s.id)}
                        className="hover:bg-red-100 rounded p-0.5"
                        title="Șterge"
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" /> Se încarcă...
          </div>
        )}
      </CardContent>

      <RawQRScannerDialog
        open={!!scanTarget}
        onOpenChange={(o) => !o && setScanTarget(null)}
        onScan={(code) => {
          if (scanTarget) {
            addScan(scanTarget, code);
          }
          setScanTarget(null);
        }}
      />
    </Card>
  );
};

export default TrasabilitateCard;
