import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";

const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

const STATUS: Record<string, string> = {
  pending: "În așteptare", assigned: "Alocată", in_progress: "În lucru", partial: "Parțială",
  completed: "Finalizată", finalizata: "Finalizată", activa: "Activă", in_lucru: "În lucru",
};
const st = (v: any) => STATUS[String(v)] ?? String(v);

function describe(e: any): { label: string; tone: string } {
  const c = e.changes && !Array.isArray(e.changes) ? e.changes : {};
  if (e.table_name === "productie_comenzi") {
    if (e.action === "insert") return { label: "Comandă creată", tone: "bg-blue-100 text-blue-800" };
    if (e.action === "delete") return { label: "Comandă ștearsă", tone: "bg-red-100 text-red-800" };
    const parts: string[] = [];
    if ("status" in c) parts.push(`Status → ${st(c.status)}`);
    if ("cantitate_din_restock" in c) parts.push(`Alocat din restoc: ${c.cantitate_din_restock}`);
    if ("cantitate" in c) parts.push(`Cantitate → ${c.cantitate}`);
    if ("linie_id" in c) parts.push("Linie schimbată");
    const done = c.status === "completed" || c.status === "finalizata";
    return { label: parts.join(" · ") || "Comandă modificată", tone: done ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800" };
  }
  if (e.table_name === "productie_sesiuni_lucru") {
    if (e.action === "insert") return { label: `Sesiune pornită${c.nume_operator ? ` (${c.nume_operator}, ${c.numar_angajati ?? "?"} op.)` : ""}`, tone: "bg-blue-100 text-blue-800" };
    if (e.action === "delete") return { label: "Sesiune ștearsă", tone: "bg-red-100 text-red-800" };
    if (c.status) return { label: `Sesiune → ${st(c.status)}${c.cantitate_produsa != null ? ` · ${c.cantitate_produsa} buc` : ""}`, tone: "bg-green-100 text-green-800" };
    return { label: "Sesiune modificată", tone: "bg-muted text-foreground" };
  }
  return { label: `Restoc: ${e.action}`, tone: "bg-purple-100 text-purple-800" };
}

export function OrderHistoryButton({ orderIds, title }: { orderIds: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <History className="h-3.5 w-3.5 mr-1" /> Istoric
      </Button>
      {open && <OrderHistoryDialog orderIds={orderIds} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

function OrderHistoryDialog({ orderIds, title, onClose }: { orderIds: string[]; title: string; onClose: () => void }) {
  const [showTech, setShowTech] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["order-history", orderIds.join(",")],
    queryFn: async () => {
      const { data: sessions } = await (supabase as any)
        .from("productie_sesiuni_lucru")
        .select("id, comanda_id, nume_operator, numar_angajati, ora_start, ora_sfarsit, cantitate_produsa, status")
        .in("comanda_id", orderIds)
        .order("ora_start", { ascending: false });
      const { data: orders } = await (supabase as any)
        .from("productie_comenzi")
        .select("id, status, cantitate, cantitate_din_restock, created_at, updated_at")
        .in("id", orderIds);
      const sessionIds = (sessions || []).map((s: any) => s.id);
      const or = [`comanda_ids.ov.{${orderIds.join(",")}}`];
      if (sessionIds.length) or.push(`record_ids.ov.{${sessionIds.join(",")}}`);
      const { data: audit } = await supabaseCloud
        .from("productie_comenzi_audit" as any)
        .select("*")
        .or(or.join(","))
        .order("created_at", { ascending: false })
        .limit(500);
      return { sessions: sessions || [], orders: orders || [], audit: (audit as any[]) || [] };
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Istoric — {title}</DialogTitle></DialogHeader>
        <div className="overflow-y-auto space-y-5 pr-1">
          {isLoading && <p className="text-sm text-muted-foreground">Se încarcă…</p>}
          {data && (
            <>
              <section>
                <h3 className="font-semibold text-sm mb-2">Stare comenzi</h3>
                <div className="space-y-1 text-xs">
                  {data.orders.map((o: any) => (
                    <div key={o.id} className="flex flex-wrap gap-3 border rounded p-2">
                      <Badge variant="outline">{st(o.status)}</Badge>
                      <span>Cantitate: <b>{o.cantitate}</b></span>
                      <span>Din restoc: <b>{o.cantitate_din_restock ?? 0}</b></span>
                      <span>Creată: {fmt(o.created_at)}</span>
                      <span>Ultima modificare: {fmt(o.updated_at)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">Jurnal modificări ({data.audit.length})</h3>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowTech((v) => !v)}>
                    {showTech ? "Ascunde detalii tehnice" : "Arată detalii tehnice"}
                  </Button>
                </div>
                {data.audit.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nicio modificare înregistrată încă. Jurnalul pornește de acum.</p>
                )}
                <div className="space-y-1.5">
                  {data.audit.map((e: any) => {
                    const d = describe(e);
                    return (
                      <div key={e.id} className="border rounded p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono">{fmt(e.created_at)}</span>
                          <span className={`px-1.5 py-0.5 rounded ${d.tone}`}>{d.label}</span>
                          <span className="text-muted-foreground">de <b className="text-foreground">{e.user_name || e.user_email || "necunoscut"}</b></span>
                          <span className="text-muted-foreground">din {e.page_path}</span>
                        </div>
                        {showTech && (
                          <pre className="mt-1 whitespace-pre-wrap break-all bg-muted p-1.5 rounded text-[10px]">
{`${e.table_name} ${e.action} ${e.filter || ""}\n${JSON.stringify(e.changes)}\n${e.source || ""}`}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-sm mb-2">Sesiuni de lucru ({data.sessions.length})</h3>
                <div className="space-y-1 text-xs">
                  {data.sessions.map((s: any) => (
                    <div key={s.id} className="flex flex-wrap gap-3 border rounded p-2">
                      <Badge variant="outline">{st(s.status)}</Badge>
                      <span>Start: <b>{fmt(s.ora_start)}</b></span>
                      <span>Final: <b>{fmt(s.ora_sfarsit)}</b></span>
                      <span>Operator: {s.nume_operator || "—"} ({s.numar_angajati ?? "?"})</span>
                      <span>Produs: {s.cantitate_produsa ?? 0}</span>
                    </div>
                  ))}
                  {data.sessions.length === 0 && <p className="text-muted-foreground">Nicio sesiune.</p>}
                </div>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
