import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Package, Clock, ChevronDown, ChevronRight, Play, CheckCircle, Users, Factory, AlertTriangle } from "lucide-react";
import { ProductieComanda, ProductieSesiuneLucru } from "@/hooks/productie/useProductionData";

interface Props {
  orders: ProductieComanda[];
  activeSessions: ProductieSesiuneLucru[];
  lineCapacity?: number;
  groupMap?: Record<string, string>;
  onOrderSelect: (orderId: string) => void;
  onStartGroup: (orderIds: string[], operatorNames: string[]) => Promise<void>;
  onFinishGroup: (orderIds: string[], totalQty: number) => Promise<void>;
}

const formatDur = (hours: number) => {
  if (!isFinite(hours) || hours <= 0) return "-";
  const totalMin = Math.max(1, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const isOrderDone = (o: any) => {
  if (o.status === "completed") return true;
  const esteReamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
  const acoperit = (o.cantitate_reala_produsa || 0) + (esteReamb ? 0 : o.cantitate_din_restock || 0);
  return o.cantitate > 0 && acoperit >= o.cantitate;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Ziua comenzii: data producției programată, altfel data creării
const orderDayKey = (o: any) => String(o?.data_productie || o?.created_at || "").slice(0, 10);

const isFromToday = (o: any) => orderDayKey(o) === todayKey();


const GroupedOrdersView: React.FC<Props> = ({
  orders,
  activeSessions,
  lineCapacity,
  groupMap,
  onOrderSelect,
  onStartGroup,
  onFinishGroup,
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hideDone, setHideDone] = useState(true);

  const [startDialog, setStartDialog] = useState<{ open: boolean; orderIds: string[]; nume: string }>({
    open: false,
    orderIds: [],
    nume: "",
  });
  const [finishDialog, setFinishDialog] = useState<{ open: boolean; orderIds: string[]; nume: string }>({
    open: false,
    orderIds: [],
    nume: "",
  });
  const [operatorNames, setOperatorNames] = useState<string[]>([""]);
  const [totalQty, setTotalQty] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      nume: string;
      unitate: string;
      isMerged: boolean;
      orders: ProductieComanda[];
    }>();
    for (const o of orders) {
      const produsId = o.produs_id || "";
      const produsNume = (o as any).productie_produse?.nume || "Fără produs";
      const grup = produsId && groupMap ? (groupMap[produsId] || "").trim() : "";
      const key = grup ? `grp:${grup}` : (produsId ? `prod:${produsId}` : `noprod-${o.id}`);
      const nume = grup || produsNume;
      if (!map.has(key)) {
        map.set(key, {
          key,
          nume,
          unitate: (o as any).productie_produse?.unitate_masura || "buc",
          isMerged: !!grup,
          orders: [],
        });
      }
      map.get(key)!.orders.push(o);
    }
    return Array.from(map.values());
  }, [orders, groupMap]);

  const openStart = (orderIds: string[], nume: string) => {
    setOperatorNames([""]);
    setStartDialog({ open: true, orderIds, nume });
  };

  const openFinish = (orderIds: string[], nume: string) => {
    setTotalQty(0);
    setFinishDialog({ open: true, orderIds, nume });
  };

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await onStartGroup(startDialog.orderIds, operatorNames);
      setStartDialog({ open: false, orderIds: [], nume: "" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await onFinishGroup(finishDialog.orderIds, totalQty);
      setFinishDialog({ open: false, orderIds: [], nume: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={hideDone ? "default" : "outline"}
          onClick={() => setHideDone((v) => !v)}
        >
          {hideDone ? "Arată finalizate" : "Ascunde finalizate"}
        </Button>
      </div>
      {groups.map((g) => {

        const totalCerut = g.orders.reduce((s, o) => s + (o.cantitate || 0), 0);
        const totalAcoperit = g.orders.reduce((s, o: any) => {
          const esteReamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
          return s + (o.cantitate_reala_produsa || 0) + (esteReamb ? 0 : o.cantitate_din_restock || 0);
        }, 0);
        const totalRamas = Math.max(0, totalCerut - totalAcoperit);
        const procent = totalCerut > 0 ? Math.round((totalAcoperit / totalCerut) * 100) : 0;
        const doneCount = g.orders.filter(isOrderDone).length;
        const visibleOrders = hideDone ? g.orders.filter((o) => !isOrderDone(o)) : g.orders;
        const groupSessions = activeSessions.filter((s) => g.orders.some((o) => o.id === s.comanda_id));
        const hasActive = groupSessions.length > 0;
        const timp = lineCapacity && lineCapacity > 0 ? totalRamas / lineCapacity : 0;
        const isExpanded = !!expanded[g.key];
        const orderIds = g.orders.map((o) => o.id);

        if (hideDone && visibleOrders.length === 0 && !hasActive) return null;

        return (

          <Card key={g.key} className={`border-coral-200 shadow ${hasActive ? "border-l-4 border-l-green-500 bg-emerald-50/40" : ""}`}>
            <CardHeader className="p-3 md:p-4 pb-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setExpanded((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <CardTitle className="text-base md:text-lg text-coral-primary truncate">
                    {g.nume}
                  </CardTitle>
                  {g.isMerged && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">grup</Badge>
                  )}
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {g.orders.length} comenzi
                  </Badge>
                  {doneCount > 0 && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0">
                      {doneCount} finalizate
                    </Badge>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  {hasActive ? (
                    <Button
                      size="sm"
                      onClick={() => openFinish(orderIds, g.nume)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Finalizează grup
                    </Button>
                  ) : (
                    totalRamas > 0 && (
                      <Button
                        size="sm"
                        onClick={() => openStart(orderIds, g.nume)}
                        className="bg-coral-primary hover:bg-coral-600 text-white"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Pornește sesiune grup
                      </Button>
                    )
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 md:p-4 pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-xs text-gray-500 flex items-center gap-1"><Package className="h-3 w-3" /> Total cerut</div>
                  <div className="font-bold text-coral-primary">{totalCerut} {g.unitate}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Acoperit</div>
                  <div className="font-bold text-green-700">{totalAcoperit} <span className="text-xs text-gray-400">({procent}%)</span></div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Rămas</div>
                  <div className={`font-bold ${totalRamas > 0 ? "text-red-600" : "text-gray-400"}`}>{totalRamas} {g.unitate}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Timp estimat</div>
                  <div className="font-bold text-blue-700">{lineCapacity && lineCapacity > 0 ? `~${formatDur(timp)}` : "—"}</div>
                </div>
              </div>

              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden mt-3">
                <div
                  className={`h-2 rounded-full ${procent >= 100 ? "bg-green-500" : procent >= 50 ? "bg-blue-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, procent)}%` }}
                />
              </div>

              {hasActive && (
                <div className="mt-3 text-xs text-green-700 flex items-center gap-1">
                  <Play className="w-3 h-3 fill-green-600" />
                  🟢 Sesiune activă: {groupSessions[0].nume_operator}
                  {" — "}
                  {new Date(groupSessions[0].ora_start).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" })}
                  {groupSessions.length > 1 && <span className="ml-1">(pe {groupSessions.length} comenzi)</span>}
                </div>
              )}

              {isExpanded && (
                <div className="mt-3 border-t pt-3 space-y-2">
                  {visibleOrders.map((o: any) => {
                    const esteReamb = o.magazin === "REAMBALARE" || o.tip_comanda === "REAMBALARE";
                    const acoperit = (o.cantitate_reala_produsa || 0) + (esteReamb ? 0 : o.cantitate_din_restock || 0);
                    const ramas = Math.max(0, (o.cantitate || 0) - acoperit);
                    const done = isOrderDone(o);
                    return (
                      <div
                        key={o.id}
                        onClick={() => onOrderSelect(o.id)}
                        className={`flex items-center justify-between gap-2 p-2 rounded border cursor-pointer hover:bg-coral-50 ${done ? "bg-green-50" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-coral-primary">{o.numar_comanda}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {o.magazin}
                            {o.productie_clienti?.nickname && (
                              <span className="text-amber-700 font-semibold"> ({o.productie_clienti.nickname})</span>
                            )}
                            {o.punct_livrare && <span className="text-gray-400"> · {o.punct_livrare}</span>}
                          </div>
                        </div>
                        <div className="text-right text-xs shrink-0">
                          <div>
                            <span className="font-bold text-green-700">{acoperit}</span>
                            <span className="text-gray-400"> / </span>
                            <span className="font-semibold">{o.cantitate}</span>
                            <span className="text-gray-500"> {o.productie_produse?.unitate_masura}</span>
                          </div>
                          {ramas > 0 && <div className="text-red-600">Lipsă: {ramas}</div>}
                          {done && <div className="text-green-600">✓ Complet</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {groups.length === 0 && (
        <Card className="border-coral-200">
          <CardContent className="p-6 text-center text-gray-500">Nu există comenzi de grupat</CardContent>
        </Card>
      )}

      {/* Dialog: Pornește sesiune grup */}
      <Dialog open={startDialog.open} onOpenChange={(open) => !open && setStartDialog({ open: false, orderIds: [], nume: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-coral-primary" />
              Pornește sesiune grup: {startDialog.nume}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Se va crea o sesiune de lucru identică pentru toate comenzile din grup care nu sunt deja finalizate.
            </p>
            <Label className="text-coral-primary font-medium">Operatori</Label>
            {operatorNames.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={name}
                  onChange={(e) => {
                    const u = [...operatorNames];
                    u[i] = e.target.value;
                    setOperatorNames(u);
                  }}
                  placeholder={`Numele operatorului ${i + 1}`}
                />
                {operatorNames.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOperatorNames(operatorNames.filter((_, x) => x !== i))}
                    className="text-red-500"
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOperatorNames([...operatorNames, ""])}
              className="border-coral-200 text-coral-primary"
            >
              + Adaugă operator
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStartDialog({ open: false, orderIds: [], nume: "" })}
              disabled={submitting}
            >
              Anulează
            </Button>
            <Button
              onClick={handleStart}
              disabled={submitting || operatorNames.every((n) => !n.trim())}
              className="bg-coral-primary hover:bg-coral-600 text-white"
            >
              <Play className="h-4 w-4 mr-1" />
              Pornește
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Finalizează grup */}
      <Dialog open={finishDialog.open} onOpenChange={(open) => !open && setFinishDialog({ open: false, orderIds: [], nume: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Finalizează sesiune grup: {finishDialog.nume}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Introdu <strong>cantitatea totală produsă</strong> pentru tot grupul. Se distribuie automat pe comenzi în ordinea priorității zonelor; surplusul intră în restocări.
            </p>
            <Label className="text-coral-primary font-medium">Cantitate totală produsă</Label>
            <Input
              type="number"
              min={0}
              value={totalQty.toString()}
              onChange={(e) => setTotalQty(parseInt(e.target.value) || 0)}
              placeholder="ex: 500"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinishDialog({ open: false, orderIds: [], nume: "" })}
              disabled={submitting}
            >
              Anulează
            </Button>
            <Button
              onClick={handleFinish}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Finalizează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupedOrdersView;
