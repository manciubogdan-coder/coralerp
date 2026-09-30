import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Factory, FileSpreadsheet, Loader2, RefreshCw, Users, Warehouse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import BackToHubButton from "@/components/BackToHubButton";
import { MessageResponse } from "@/components/ai-elements/message";
import ArgusChat from "@/components/argus/ArgusChat";
import { argusFetch } from "@/lib/argusApi";
import argusLogo from "@/assets/argus-logo.png";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Bucharest" });
const shift = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const fmt = (n: number | undefined, d = 0) =>
  (n ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: d, minimumFractionDigits: 0 });

function Delta({ cur, prev, inverse = false }: { cur: number; prev: number | undefined; inverse?: boolean }) {
  if (!prev) return null;
  const pct = ((cur - prev) / prev) * 100;
  const good = inverse ? pct <= 0 : pct >= 0;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${good ? "text-primary" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {fmt(Math.abs(pct), 1)}% vs perioada anterioară
    </span>
  );
}

function Kpi({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: React.ReactNode; icon: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          {label}
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 min-h-4">{sub}</div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({ cols, rows }: { cols: Array<[string, string, ((v: any, r: any) => React.ReactNode)?]>; rows: any[] }) {
  if (!rows?.length) return <p className="py-4 text-sm text-muted-foreground">Nu există date în perioada aleasă.</p>;
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-left text-muted-foreground">
            {cols.map(([, h]) => (
              <th key={h} className="px-2 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {cols.map(([k, h, f]) => (
                <td key={h} className="px-2 py-1.5 tabular-nums">{f ? f(r[k], r) : r[k]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary() {
  const [s, setS] = useState<{ content: string; day: string } | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const load = (refresh = false) => {
    setBusy(true);
    setErr(null);
    argusFetch("summary", refresh ? { refresh: "1" } : {})
      .then(setS)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => load(), []);
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <img src={argusLogo} alt="" className="h-6 w-6" /> Rezumatul de dimineață (ziua de ieri)
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => load(true)} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="text-sm">
        {busy && !s ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Argus scrie rezumatul…</div>
        ) : err ? (
          <p className="text-destructive">{err}</p>
        ) : (
          <MessageResponse>{s?.content ?? ""}</MessageResponse>
        )}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [from, setFrom] = useState(shift(today(), -6));
  const [to, setTo] = useState(today());
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = () => {
    setBusy(true);
    setErr(null);
    argusFetch("overview", { from, to })
      .then(setD)
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(load, [from, to]);

  const preset = (days: number) => {
    const t = today();
    setTo(days === -1 ? shift(t, -1) : t);
    setFrom(days === -1 ? shift(t, -1) : shift(t, -(days - 1)));
  };

  const exportAll = () => {
    if (!d) return;
    const wb = XLSX.utils.book_new();
    const add = (name: string, rows: any[]) =>
      rows?.length && XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31));
    add("Productie pe linie", d.productie.pe_linie);
    add("Operatori", d.productie.pe_operator);
    add("Productie zilnica", d.productie.zilnic);
    add("Utilizatori activi", d.oameni.activi.map((u: any) => ({ nume: u.nume, email: u.email, ore: u.ore, ultima_activitate: u.ultima_activitate, huburi: u.huburi.map((h: any) => `${h.hub} ${h.ore}h`).join(", ") })));
    add("Utilizatori inactivi", d.oameni.inactivi);
    add("Greseli pe persoana", d.anomalii.pe_persoana);
    add("Sesiuni suspecte", d.anomalii.sesiuni_suspecte);
    XLSX.writeFile(wb, `argus-${from}_${to}.xlsx`);
  };

  const p = d?.productie, prev = d?.perioada_anterioara?.productie;
  const recTotal = d ? d.depozite.materii_prime.receptii + d.depozite.ambalaje.receptii + d.depozite.etichete.receptii : 0;
  const errTotal = d ? d.anomalii.redeschideri_comenzi + d.anomalii.stergeri + d.anomalii.modificari_receptii_dupa_salvare + d.anomalii.corectii_stoc : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        {[["Ieri", -1], ["Azi", 1], ["7 zile", 7], ["30 zile", 30], ["90 zile", 90]].map(([l, n]) => (
          <Button key={l as string} variant="outline" size="sm" onClick={() => preset(n as number)}>{l}</Button>
        ))}
        <div className="flex items-center gap-1 text-sm">
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 w-40" />
          <span>—</span>
          <Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 w-40" />
        </div>
        <Button size="sm" variant="secondary" onClick={exportAll} disabled={!d}>
          <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
        </Button>
        {busy && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      <Summary />

      {err && <p className="text-sm text-destructive">{err}</p>}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Kpi label="Produs (buc)" icon={Factory} value={fmt(p.cantitate_produsa)} sub={<Delta cur={p.cantitate_produsa} prev={prev?.cantitate_produsa} />} />
            <Kpi label="Buc / oră-om" icon={Factory} value={fmt(p.productivitate_buc_ora_om, 1)} sub={<Delta cur={p.productivitate_buc_ora_om} prev={prev?.productivitate_buc_ora_om} />} />
            <Kpi label="Rebut (kg)" icon={AlertTriangle} value={fmt(p.rebut_kg, 1)} sub={<Delta cur={p.rebut_kg} prev={prev?.rebut_kg} inverse />} />
            <Kpi label="Oameni activi" icon={Users} value={`${d.oameni.utilizatori_activi}`} sub={<span className="text-xs text-muted-foreground">{fmt(d.oameni.ore_totale, 1)} ore în aplicație · {d.oameni.inactivi.length} inactivi</span>} />
            <Kpi label="Recepții" icon={Warehouse} value={`${recTotal}`} sub={<span className="text-xs text-muted-foreground">{d.depozite.transferuri.numar} transferuri în producție</span>} />
            <Kpi label="Semnale de greșeli" icon={AlertTriangle} value={`${errTotal}`} sub={<span className="text-xs text-muted-foreground">{d.anomalii.redeschideri_comenzi} redeschideri · {d.anomalii.corectii_stoc} corecții</span>} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Producție pe zile (buc)</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={p.zilnic}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="zi" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="cantitate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Timp în aplicație pe huburi (ore)</CardTitle></CardHeader>
              <CardContent className="h-64">
                {d.oameni.pe_hub.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.oameni.pe_hub} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="hub" width={110} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="ore" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Nu s-a înregistrat activitate în aplicație în această perioadă.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Linii de producție</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable rows={p.pe_linie} cols={[["linie", "Linie"], ["sesiuni", "Sesiuni"], ["cantitate", "Buc", (v) => fmt(v)], ["ore", "Ore", (v) => fmt(v, 1)], ["buc_pe_ora", "Buc/oră", (v) => fmt(v, 1)], ["rebut_kg", "Rebut kg", (v) => fmt(v, 1)]]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Operatori — cine produce</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable rows={p.pe_operator} cols={[["operator", "Operator"], ["sesiuni", "Sesiuni"], ["cantitate", "Buc", (v) => fmt(v)], ["buc_pe_ora_om", "Buc/oră-om", (v) => fmt(v, 1)], ["partiale", "Parțiale"], ["rebut_kg", "Rebut kg", (v) => fmt(v, 1)]]} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Cine lucrează în aplicație</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable rows={d.oameni.activi} cols={[["nume", "Nume"], ["ore", "Ore", (v) => fmt(v, 1)], ["huburi", "Unde", (v: any[]) => v.slice(0, 3).map((h) => h.hub).join(", ")], ["ultima_activitate", "Ultima dată", (v) => new Date(v).toLocaleString("ro-RO")]]} />
                {d.oameni.inactivi.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 text-sm font-medium">Fără activitate în perioadă</div>
                    <div className="flex flex-wrap gap-1">
                      {d.oameni.inactivi.map((u: any) => (
                        <Badge key={u.email} variant="outline">{u.nume}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Cine greșește — modificări și corecturi</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable rows={d.anomalii.pe_persoana} cols={[["persoana", "Persoană"], ["redeschideri_comenzi", "Redeschideri"], ["stergeri", "Ștergeri"], ["modificari_receptii", "Modif. recepții"], ["modificari_comenzi", "Modif. comenzi"], ["total", "Total"]]} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {([["Materii Prime", d.depozite.materii_prime], ["Ambalaje", d.depozite.ambalaje], ["Etichete", d.depozite.etichete]] as const).map(([name, s]: any) => (
              <Card key={name}>
                <CardHeader className="pb-2"><CardTitle className="text-base">Depozit {name}</CardTitle></CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div>{s.receptii} recepții · {fmt(s.cantitate_bruta, 1)} brut</div>
                  <div className={s.corectii ? "text-destructive" : "text-muted-foreground"}>{s.corectii} corecții de stoc</div>
                  {s.top_furnizori.length > 0 && (
                    <div className="pt-1 text-muted-foreground">Top: {s.top_furnizori.map((f: any) => `${f.furnizor} (${f.receptii})`).join(", ")}</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {d.anomalii.sesiuni_suspecte.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Sesiuni suspecte</CardTitle></CardHeader>
              <CardContent>
                <SimpleTable rows={d.anomalii.sesiuni_suspecte} cols={[["tip", "Problemă"], ["operator", "Operator"], ["linie", "Linie"], ["cantitate", "Buc", (v) => fmt(v)], ["data", "Data", (v) => new Date(v).toLocaleString("ro-RO")]]} />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

const ArgusPage: React.FC = () => {
  const { threadId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const tab = location.pathname.includes("/argus/chat") ? "chat" : "tablou";
  return (
    <div className="container mx-auto space-y-4 px-2 py-3 md:px-6 md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src={argusLogo} alt="Argus" className="h-12 w-12" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Argus</h1>
            <p className="text-sm text-muted-foreground">Ochiul care vede tot ce mișcă în firmă.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => navigate(v === "chat" ? "/administrativ/argus/chat" : "/administrativ/argus")}>
            <TabsList>
              <TabsTrigger value="tablou">Tablou de bord</TabsTrigger>
              <TabsTrigger value="chat">Întreabă-l pe Argus</TabsTrigger>
            </TabsList>
          </Tabs>
          <BackToHubButton />
        </div>
      </div>
      {tab === "chat" ? <ArgusChat threadId={threadId} /> : <Dashboard />}
    </div>
  );
};

export default ArgusPage;
