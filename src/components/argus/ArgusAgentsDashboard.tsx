import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Loader2, MoreHorizontal, Move, Pencil, Plus, RefreshCw, Trash2, Maximize2, Zap, Download, Table2, Copy } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { argusFetch } from "@/lib/argusApi";
import ArgusWidgetRenderer from "./ArgusWidgetRenderer";
import { AgentFilterBar, AgentFiltersEditor, type AgentFilter } from "./AgentFilters";
import ReportTableEditor from "./ReportTableEditor";
import { reportTables, type ReportView } from "@/lib/argus/reportTables";
import { exportReport } from "@/lib/argus/exportReport";

const SCHED: Record<string, string> = { on_demand: "La cerere", daily: "Zilnic", weekly: "Săptămânal", monthly: "Lunar" };
const WIDGET: Record<string, string> = { auto: "Auto", bar_chart: "Bare", line_chart: "Linie", pie_chart: "Pie", kpi: "KPI", table: "Tabel", markdown: "Text" };
const SPAN: Record<number, string> = { 1: "", 2: "md:col-span-2", 3: "md:col-span-2 lg:col-span-3" };

function ago(iso?: string) {
  if (!iso) return "Niciodată";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Actualizat acum";
  if (m < 60) return `Actualizat acum ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `Actualizat acum ${h} ${h === 1 ? "oră" : "ore"}`;
  return `Actualizat acum ${Math.round(h / 24)} zile`;
}

type CardRow = { id: string; template_id: string; position_order: number; column_span: number; report_view?: ReportView | null; argus_report_templates: any };

export default function ArgusAgentsDashboard() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [reports, setReports] = useState<Record<string, any>>({});
  const [me, setMe] = useState("");
  const [paused, setPaused] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [reorder, setReorder] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [tableEditing, setTableEditing] = useState<CardRow | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const download = async (c: CardRow) => {
    const content = reports[c.template_id]?.content_json;
    if (!content) return;
    setExporting(c.id);
    try { await exportReport(content, c.report_view); }
    catch (e) { toast({ title: "Export nereușit", description: (e as Error).message, variant: "destructive" }); }
    finally { setExporting(null); }
  };
  const saveView = async (view: ReportView | null) => {
    if (!tableEditing) return;
    try {
      await argusFetch("agent_card_update", { id: tableEditing.id }, { report_view: view });
      setCards(cs => cs.map(c => c.id === tableEditing.id ? { ...c, report_view: view } : c));
      toast({ title: "Tabel salvat" });
    } catch (e) {
      toast({ title: "Tabelul nu a fost salvat", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await argusFetch<any>("agents_list");
      setCards(r.cards ?? []); setReports(r.reports ?? {}); setMe(r.me); setPaused(r.paused);
    } catch (e) { toast({ title: "Eroare", description: (e as Error).message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const run = async (templateId: string) => {
    setRunning((s) => ({ ...s, [templateId]: true }));
    try {
      const r = await argusFetch<any>("agent_run", { id: templateId }, { values: values[templateId] ?? {} });
      // The agent runs in the background on the server; poll until its report is no longer pending (max ~8 min).
      if (r?.background) {
        for (let i = 0; i < 96; i++) {
          await new Promise((res) => setTimeout(res, 5000));
          const l = await argusFetch<any>("agents_list").catch(() => null);
          if (l && !l.reports?.[templateId]?.running) break;
        }
      }
    }
    catch (e) { toast({ title: "Agentul nu a putut rula", description: (e as Error).message, variant: "destructive" }); }
    finally { setRunning((s) => ({ ...s, [templateId]: false })); load(); }
  };

  const setSpan = async (c: CardRow) => {
    const next = c.column_span >= 3 ? 1 : c.column_span + 1;
    setCards((cs) => cs.map((x) => (x.id === c.id ? { ...x, column_span: next } : x)));
    await argusFetch("agent_card_update", { id: c.id }, { column_span: next }).catch(() => load());
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const n = [...cards]; [n[i], n[j]] = [n[j], n[i]]; setCards(n);
  };
  const saveOrder = async () => {
    setReorder(false);
    await argusFetch("agents_reorder", {}, { ids: cards.map((c) => c.id) }).catch((e) => toast({ title: "Eroare", description: e.message, variant: "destructive" }));
  };

  // Answers to the agent's questions become permanent clarifications in its instructions, then it reruns.
  const answer = async (c: CardRow, text: string) => {
    const t = c.argus_report_templates;
    const base = String(t.prompt_instructions ?? "");
    const marker = "\n\nPrecizări de la utilizator:";
    const add = `\n- ${text.trim()}`;
    let next = base.includes(marker) ? base + add : base + marker + add;
    if (next.length > 4000) next = next.slice(0, 4000);
    try {
      if (t.created_by === me) {
        await argusFetch("agent_update", { id: t.id }, { prompt_instructions: next });
        await load(); run(t.id);
      } else {
        const n = await argusFetch<any>("agent_create", {}, { title: `${t.title} — personalizat`, description: t.description ?? "", prompt_instructions: next, preferred_widget_type: t.preferred_widget_type, schedule_type: "on_demand", is_public: false, params: Array.isArray(t.params) ? t.params : [] });
        toast({ title: "Am creat copia ta personalizată" });
        await load(); run(n.id);
      }
    } catch (e) { toast({ title: "Răspunsul nu a fost salvat", description: (e as Error).message, variant: "destructive" }); }
  };

  const remove = async (c: CardRow) => { await argusFetch("agent_card_remove", { id: c.id }, {}); load(); };
  const destroy = async (c: CardRow) => {
    if (!confirm(`Ștergi definitiv agentul „${c.argus_report_templates.title}"? Dispare de pe tablourile tuturor.`)) return;
    await argusFetch("agent_delete", { id: c.template_id }, {}); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Tablou de Bord Rapoarte & Agenți Argus</h2>
        <div className="flex flex-wrap gap-2">
          {reorder ? (
            <Button onClick={saveOrder}><Check className="mr-1 h-4 w-4" />Salvează ordinea</Button>
          ) : (
            <Button variant="outline" onClick={() => setReorder(true)} disabled={cards.length < 2}><Move className="mr-1 h-4 w-4" />Rearanjează Carduri</Button>
          )}
          <Button variant="outline" onClick={() => setLibOpen(true)}><BookOpen className="mr-1 h-4 w-4" />Librărie Șabloane</Button>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" />Agent Nou</Button>
        </div>
      </div>

      {paused && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <span>Rularea automată e pe pauză: {paused}</span>
          <Button size="sm" variant="outline" onClick={async () => { await argusFetch("agents_resume", {}, {}); load(); }}>Reia rularea automată</Button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
      ) : cards.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nu ai încă agenți. Creează unul nou sau alege din librărie.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((c, i) => {
            const t = c.argus_report_templates;
            const r = reports[c.template_id];
            const busy = running[c.template_id] || r?.running;
            return (
              <Card key={c.id} className={`flex flex-col ${SPAN[c.column_span] ?? ""} ${reorder ? "ring-2 ring-primary/40" : ""}`}>
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{r?.content_json?.title || t.title}</CardTitle>
                    {reorder ? (
                      <div className="flex shrink-0 gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Mută înainte"><ArrowLeft className="h-4 w-4" /></Button>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === cards.length - 1} aria-label="Mută după"><ArrowRight className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label="Opțiuni"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => run(c.template_id)} disabled={busy}><RefreshCw className="mr-2 h-4 w-4" />Rulează acum</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setSpan(c)}><Maximize2 className="mr-2 h-4 w-4" />{c.column_span >= 3 ? "Strânge cardul" : "Lățește cardul"}</DropdownMenuItem>
                          {t.created_by === me && <DropdownMenuItem onClick={() => setEditing(t)}><Pencil className="mr-2 h-4 w-4" />Editează agentul</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setEditing({ ...t, id: undefined, title: `${t.title} — copie`, is_public: false })}><Copy className="mr-2 h-4 w-4" />Copiază și personalizează</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => download(c)} disabled={!r?.content_json || exporting === c.id}><Download className="mr-2 h-4 w-4" />Export Excel</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setTableEditing(c)} disabled={!r?.content_json || !reportTables(r.content_json).length || busy}><Table2 className="mr-2 h-4 w-4" />Editează tabelul</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(c)}>Șterge din Dashboard</DropdownMenuItem>
                          {t.created_by === me && <DropdownMenuItem className="text-destructive" onClick={() => destroy(c)}><Trash2 className="mr-2 h-4 w-4" />Șterge definitiv Agentul</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{SCHED[t.schedule_type] ?? t.schedule_type}</Badge>
                    <Badge variant="outline">{WIDGET[r?.content_json?.widget_type ?? t.preferred_widget_type] ?? "Auto"}</Badge>
                    {t.live_spec && <Badge className="gap-1"><Zap className="h-3 w-3" />Live · fără credite AI</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <AgentFilterBar
                    filters={Array.isArray(t.params) ? t.params : []}
                    values={values[c.template_id] ?? r?.content_json?.filtre ?? {}}
                    onChange={(v) => setValues((s) => ({ ...s, [c.template_id]: v }))}
                    onRun={() => run(c.template_id)} busy={busy}
                  />
                  {t.live_spec && !(Array.isArray(t.params) && t.params.length) && (
                    <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{r?.executed_at ? `Actualizat ${new Date(r.executed_at).toLocaleString("ro-RO")}` : ""}</span>
                      <Button size="sm" className="h-8" onClick={() => run(c.template_id)} disabled={busy}><RefreshCw className="mr-1 h-3.5 w-3.5" />Actualizează</Button>
                    </div>
                  )}
                  {busy ? (
                    <div className="space-y-2"><Skeleton className="h-40" /><p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{t.live_spec ? "Citesc cifrele la zi din Senior…" : "Argus analizează datele…"}</p></div>
                  ) : r?.status === "completed" && r.content_json ? (
                    <><div className="mb-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => download(c)} disabled={exporting === c.id}>{exporting === c.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}Excel</Button>
                      {!!reportTables(r.content_json).length && <Button variant="outline" size="sm" onClick={() => setTableEditing(c)}><Table2 className="mr-1 h-4 w-4" />Editează tabelul</Button>}
                      {t.created_by === me && <Button variant="outline" size="sm" onClick={() => setEditing(t)}><Pencil className="mr-1 h-4 w-4" />Editează agentul</Button>}
                    </div><ArgusWidgetRenderer content={r.content_json} view={c.report_view} />
                    {!t.live_spec && <AnswerBox mine={t.created_by === me} onSend={(text) => answer(c, text)} />}</>
                  ) : r?.status === "failed" ? (
                    <p className="text-sm text-destructive">Ultima rulare a eșuat: {r.error}</p>
                  ) : (
                    <div className="py-8 text-center"><Button variant="outline" onClick={() => run(c.template_id)}><RefreshCw className="mr-1 h-4 w-4" />Rulează prima dată</Button></div>
                  )}
                </CardContent>
                <CardFooter className="pt-0 text-xs text-muted-foreground">{ago(r?.executed_at)}</CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <CreateReportModal open={createOpen} onOpenChange={setCreateOpen} onCreated={async (id) => { await load(); run(id); }} />
      <CreateReportModal
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        initial={editing}
        onCreated={async (id) => { setEditing(null); await load(); run(id); }}
      />
      <ReportTableEditor open={!!tableEditing} onOpenChange={o => { if (!o) setTableEditing(null); }} tables={tableEditing && reports[tableEditing.template_id]?.content_json ? reportTables(reports[tableEditing.template_id].content_json) : []} view={tableEditing?.report_view} onSave={saveView} />
      <TemplateLibraryModal open={libOpen} onOpenChange={setLibOpen} onAdded={load} />
    </div>
  );
}

function AnswerBox({ mine, onSend }: { mine: boolean; onSend: (t: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
      <label className="text-sm font-medium">Răspunde agentului sau cere o schimbare</label>
      <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="ex: Vreau cantități, valori și preț mediu; fiecare ingredient separat pe lună" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{mine ? "Se păstrează în agent și îl rulez din nou." : "Îți fac o copie personalizată și o rulez."}</span>
        <Button size="sm" disabled={!text.trim() || sending} onClick={async () => { setSending(true); try { await onSend(text); setText(""); } finally { setSending(false); } }}>{sending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Trimite și rulează</Button>
      </div>
    </div>
  );
}

export function CreateReportModal({ open, onOpenChange, onCreated, initial }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void; initial?: any | null }) {
  const empty = { title: "", description: "", prompt_instructions: "", preferred_widget_type: "auto", schedule_type: "on_demand", is_public: false, params: [] as AgentFilter[], live_spec: null as any };
  const [f, setF] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [proposal, setProposal] = useState("");
  const [proposing, setProposing] = useState(false);
  const source = initial?.propose as { question: string; answer: string } | undefined;
  const propose = async (wish = "") => {
    if (!source) return;
    setProposing(true);
    try {
      const r = await argusFetch<any>("agent_propose_filters", {}, { question: source.question + (wish ? `\n\nUtilizatorul vrea exact aceste filtre: ${wish}` : ""), answer: source.answer });
      setProposal(r.mesaj ?? ""); setF((x) => ({ ...x, params: r.filtre ?? [] }));
    } catch (e) { toast({ title: "Nu am putut propune filtre", description: (e as Error).message, variant: "destructive" }); }
    finally { setProposing(false); }
  };
  useEffect(() => {
    if (!open) return;
    setProposal("");
    setF(initial ? {
      title: initial.title ?? "", description: initial.description ?? "",
      prompt_instructions: initial.prompt_instructions ?? "",
      preferred_widget_type: initial.preferred_widget_type ?? "auto",
      schedule_type: initial.schedule_type ?? "on_demand", is_public: !!initial.is_public,
      params: Array.isArray(initial.params) ? initial.params : [],
      live_spec: initial.live_spec ?? null,
    } : empty);
    if (initial?.propose) propose();
  }, [open, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async () => {
    setSaving(true);
    try {
      if (initial?.id) {
        await argusFetch("agent_update", { id: initial.id }, f);
        onOpenChange(false); onCreated(initial.id);
      } else {
        const t = await argusFetch<any>("agent_create", {}, f);
        onOpenChange(false); setF(empty); onCreated(t.id);
      }
    } catch (e) { toast({ title: "Eroare", description: (e as Error).message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col">
        <DialogHeader><DialogTitle>{initial?.id ? "Editează Agentul" : "Creează Agent Nou"}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1"><label className="text-sm font-medium">Titlu Raport</label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="ex: Rebut pe linii în ultimele 7 zile" /></div>
          <div className="space-y-1"><label className="text-sm font-medium">Descriere</label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          {f.live_spec ? <div className="space-y-2 rounded-md border p-3 text-sm"><p>Raport live: cifrele se actualizează direct din Senior, fără credite AI.</p><Button variant="outline" size="sm" onClick={() => { if (confirm("Transformi raportul într-un agent Argus? Rulările vor folosi credite AI și noile instrucțiuni, nu calculul live salvat.")) setF({ ...f, live_spec: null, prompt_instructions: f.prompt_instructions.replace(/^\[(raport live|fișă preț live)\]\s*/, "") }); }}>Modifică analiza cu Argus</Button></div> : <div className="space-y-1"><label className="text-sm font-medium">Instrucțiuni pentru Argus</label><Textarea rows={6} value={f.prompt_instructions} onChange={(e) => setF({ ...f, prompt_instructions: e.target.value })} placeholder="Ce vrei să calculeze Argus, pe ce perioadă, cum să grupeze…" /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-sm font-medium">Format vizual</label>
              <Select value={f.preferred_widget_type} onValueChange={(v) => setF({ ...f, preferred_widget_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (alege Argus)</SelectItem><SelectItem value="bar_chart">Grafic cu bare</SelectItem><SelectItem value="line_chart">Grafic linie</SelectItem>
                  <SelectItem value="pie_chart">Grafic pie</SelectItem><SelectItem value="kpi">Card KPI</SelectItem><SelectItem value="table">Tabel</SelectItem><SelectItem value="markdown">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><label className="text-sm font-medium">Frecvență rulare</label>
              <Select value={f.schedule_type} onValueChange={(v) => setF({ ...f, schedule_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="on_demand">La cerere</SelectItem><SelectItem value="daily">Zilnic (06:00)</SelectItem><SelectItem value="weekly">Săptămânal (luni)</SelectItem><SelectItem value="monthly">Lunar (pe 1)</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {f.live_spec ? <p className="text-xs text-muted-foreground">Filtrele live rămân legate de calculul salvat; valorile se aleg pe raport. Pentru alte calcule, alege „Modifică analiza cu Argus”.</p> : <AgentFiltersEditor filters={f.params} onChange={(params) => setF({ ...f, params })} proposal={proposal} proposing={proposing} onRepropose={source ? propose : undefined} />}
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>Public — salvează în Librăria CoralERP pentru toți colegii</span>
            <Switch checked={f.is_public} onCheckedChange={(v) => setF({ ...f, is_public: v })} />
          </label>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={saving || proposing || !f.title.trim() || !f.prompt_instructions.trim()}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{initial?.id ? "Salvează modificările" : "Creează și Execută Acum"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateLibraryModal({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (o: boolean) => void; onAdded: () => void }) {
  const [list, setList] = useState<any[] | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    setList(null);
    argusFetch<any>("agents_library").then((r) => { setList(r.templates ?? []); setMine(r.mine ?? []); }).catch(() => setList([]));
  }, [open]);
  const add = async (id: string) => { await argusFetch("agent_add", { id }, {}); setMine((m) => [...m, id]); onAdded(); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader><DialogTitle>Librărie Șabloane</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!list ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : list.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Niciun șablon public încă.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((t) => {
                const has = mine.includes(t.id);
                return (
                  <Card key={t.id} className="flex flex-col">
                    <CardHeader className="pb-2"><CardTitle className="text-base">{t.title}</CardTitle></CardHeader>
                    <CardContent className="flex-1 space-y-2 text-sm">
                      {t.description && <p className="text-muted-foreground">{t.description}</p>}
                      <div className="flex flex-wrap gap-1 text-xs"><Badge variant="secondary">{SCHED[t.schedule_type]}</Badge><Badge variant="outline">{t.created_by_name ?? "—"}</Badge></div>
                    </CardContent>
                    <CardFooter>
                      <Button size="sm" className="w-full" variant={has ? "secondary" : "default"} disabled={has} onClick={() => add(t.id)}>
                        {has ? <><Check className="mr-1 h-4 w-4" />Adăugat</> : <><Plus className="mr-1 h-4 w-4" />Adaugă pe Dashboard-ul Meu</>}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
