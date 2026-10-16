import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Database, Rows3, AlertTriangle, Clock, RotateCcw } from 'lucide-react';
import BackToHubButton from '@/components/BackToHubButton';
import { supabase } from '@/integrations/supabase/client';

const CLOUD_URL = 'https://yeniohmlmxhjzywqlidx.supabase.co';
const CLOUD_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE';

interface MirrorTable {
  table_name: string;
  source_name: string;
  row_count: number;
  last_synced_at: string | null;
  last_error: string | null;
  retry_requested?: boolean;
}
interface MirrorRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  host: string | null;
  tables_total: number | null;
  tables_synced: number | null;
  tables_done?: number | null;
  tables_copied_live?: number | null;
  current_table?: string | null;
  current_rows?: number | null;
  current_total?: number | null;
  heartbeat_at?: string | null;
  tables_skipped: number | null;
  rows_synced: number | null;
  errors: Array<{ table: string; error: string }> | null;
}
interface Status {
  totals: { tables: number; rows: number; last_synced_at: string | null; tables_with_errors: number };
  runs: MirrorRun[];
  tables: MirrorTable[];
}

const fmtNum = (n: number | null | undefined) => (n ?? 0).toLocaleString('ro-RO');
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' }) : '—';
const ago = (iso: string | null | undefined) => {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'chiar acum';
  if (min < 60) return `acum ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `acum ${h} h`;
  return `acum ${Math.floor(h / 24)} zile`;
};

const ErpMirrorStatusPage: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const [retrying, setRetrying] = useState<string | null>(null);

  const callFn = useCallback(async (payload: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    return edgeFetchJson(`${CLOUD_URL}/functions/v1/erp-mirror`, {
      method: 'POST',
      headers: {
        apikey: CLOUD_ANON,
        Authorization: `Bearer ${CLOUD_ANON}`,
        'x-app-token': data.session?.access_token ?? '',
      },
      body: payload,
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await callFn({ action: 'status' });
      setStatus(json as Status);
      setRefreshedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [callFn]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const lastRun = status?.runs?.[0];
  const running = !!lastRun && !lastRun.finished_at;
  const total = lastRun?.tables_total || 0;
  const done = Math.max(
    lastRun?.tables_done ?? 0,
    (lastRun?.tables_synced ?? 0) + (lastRun?.tables_skipped ?? 0),
    lastRun?.tables_copied_live ?? 0,
  );
  const hasLive = lastRun?.tables_done != null;
  const curPct = lastRun?.current_total ? Math.min(100, Math.round(((lastRun.current_rows ?? 0) / lastRun.current_total) * 100)) : null;
  const errorTables = (status?.tables ?? []).filter((t) => t.last_error);

  const retry = async (tables: string[] | null, key: string) => {
    setRetrying(key);
    try {
      const r = await callFn({ action: 'retry', tables });
      toast.success(`${r.marked} tabele marcate. Se recopiază la următoarea verificare a programului (max. 30 min).`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRetrying(null);
    }
  };
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Oglindire Senior ERP</h1>
          <p className="text-muted-foreground">
            Starea copierii bazei de date din Senior ERP în Coral ERP.
            {refreshedAt && ` Actualizat la ${refreshedAt.toLocaleTimeString('ro-RO')}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Reîncarcă
          </Button>
          <BackToHubButton />
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4 text-destructive">{error}</CardContent>
        </Card>
      )}

      {status && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Database className="h-4 w-4" /> Tabele copiate
                </CardDescription>
                <CardTitle className="text-2xl">{fmtNum(status.totals.tables)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                din {fmtNum(total || status.totals.tables)} găsite în Senior ERP
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Rows3 className="h-4 w-4" /> Rânduri copiate
                </CardDescription>
                <CardTitle className="text-2xl">{fmtNum(status.totals.rows)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">în total, pe toate tabelele</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Ultima actualizare
                </CardDescription>
                <CardTitle className="text-2xl">{ago(status.totals.last_synced_at) || '—'}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{fmtDate(status.totals.last_synced_at)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Tabele cu erori
                </CardDescription>
                <CardTitle className="text-2xl">{fmtNum(status.totals.tables_with_errors)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">vezi lista de mai jos</CardContent>
            </Card>
          </div>

          {lastRun && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  Rularea curentă
                  {running ? <Badge>în curs</Badge> : <Badge variant="secondary">terminată</Badge>}
                </CardTitle>
                <CardDescription>
                  Pornită la {fmtDate(lastRun.started_at)}
                  {lastRun.finished_at && `, terminată la ${fmtDate(lastRun.finished_at)}`}
                  {lastRun.host && `, pe serverul ${lastRun.host}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-14 text-right">{pct}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {fmtNum(done)} din {fmtNum(total)} tabele verificate în această rulare
                  {hasLive && <> ({fmtNum(lastRun.tables_synced)} copiate, {fmtNum(lastRun.tables_skipped)} neschimbate, {fmtNum(lastRun.rows_synced)} rânduri trimise)</>}.
                </p>
                {running && lastRun.current_table && (
                  <div className="rounded-md border p-3 text-sm space-y-2">
                    <p>
                      Acum copiază: <span className="font-mono">{lastRun.current_table}</span> —{' '}
                      {fmtNum(lastRun.current_rows ?? 0)}
                      {lastRun.current_total ? ` din ~${fmtNum(lastRun.current_total)} rânduri` : ' rânduri'}
                      {curPct != null && ` (${curPct}%)`}
                    </p>
                    {curPct != null && (
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${curPct}%` }} />
                      </div>
                    )}
                    <p className="text-muted-foreground">Ultimul semn de viață de la program: {ago(lastRun.heartbeat_at ?? null)}</p>
                  </div>
                )}
                {running && !hasLive && (
                  <p className="text-sm rounded-md bg-muted p-3">
                    Programul de pe server e o versiune veche și nu raportează progresul pe parcurs — de aceea apare 0%.
                    „Rânduri copiate” și „Ultima actualizare” se schimbă doar când se termină un tabel; acum lucrează la un tabel mare.
                    Instalează versiunea 1.6 ca să vezi aici progresul live și tabelul curent.
                  </p>
                )}
                {!!lastRun.errors?.length && (
                  <div className="text-sm">
                    <p className="font-medium text-destructive mb-1">Erori în această rulare:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      {lastRun.errors.slice(0, 10).map((e, i) => (
                        <li key={i}>
                          <span className="font-mono">{e.table}</span>: {e.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tabele oglindite ({fmtNum(status.totals.tables)})</CardTitle>
              <CardDescription>Întâi cele cu erori, apoi după ultima actualizare. Se reîmprospătează automat la fiecare minut.</CardDescription>
              {errorTables.length > 0 && (
                <div className="pt-2">
                  <Button size="sm" variant="outline" disabled={!!retrying} onClick={() => retry(null, 'all')}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Recopiază toate tabelele cu erori ({errorTables.length})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Tabel în Senior ERP</TableHead>
                      <TableHead className="text-right">Rânduri</TableHead>
                      <TableHead>Ultima copiere</TableHead>
                      <TableHead>Stare</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {status.tables.map((t) => (
                      <TableRow key={t.table_name}>
                        <TableCell className="font-mono text-xs">{t.source_name}</TableCell>
                        <TableCell className="text-right">{fmtNum(t.row_count)}</TableCell>
                        <TableCell className="text-sm">
                          {fmtDate(t.last_synced_at)}
                          <span className="text-muted-foreground"> ({ago(t.last_synced_at)})</span>
                        </TableCell>
                        <TableCell>
                          {t.retry_requested ? (
                            <Badge>în coadă</Badge>
                          ) : t.last_error ? (
                            <Badge variant="destructive" title={t.last_error}>eroare</Badge>
                          ) : (
                            <Badge variant="secondary">ok</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" disabled={!!retrying || t.retry_requested} onClick={() => retry([t.table_name], t.table_name)} title="Recopiază acest tabel">
                            <RotateCcw className={`h-4 w-4 ${retrying === t.table_name ? 'animate-spin' : ''}`} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ErpMirrorStatusPage;
