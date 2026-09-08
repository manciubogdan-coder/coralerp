import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabaseCloud } from '@/integrations/supabase/cloudClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, Clock, RefreshCw, Users } from 'lucide-react';
import BackToHubButton from '@/components/BackToHubButton';
import { formatDuration, labelForPath } from '@/lib/activityTracking';

interface PingRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  path: string;
  tab: string | null;
  seconds: number;
  occurred_at: string;
}

const toInputDate = (d: Date) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
};

const PRESETS = [
  { key: 'today', label: 'Azi' },
  { key: '7', label: 'Ultimele 7 zile' },
  { key: '30', label: 'Ultimele 30 zile' },
  { key: 'custom', label: 'Interval' },
] as const;

type PresetKey = (typeof PRESETS)[number]['key'];

const ActivityTrackingPage: React.FC = () => {
  const today = new Date();
  const [preset, setPreset] = React.useState<PresetKey>('7');
  const [from, setFrom] = React.useState(toInputDate(new Date(today.getTime() - 6 * 86400000)));
  const [to, setTo] = React.useState(toInputDate(today));
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    const now = new Date();
    if (key === 'today') {
      setFrom(toInputDate(now));
      setTo(toInputDate(now));
    } else if (key === '7' || key === '30') {
      const days = Number(key);
      setFrom(toInputDate(new Date(now.getTime() - (days - 1) * 86400000)));
      setTo(toInputDate(now));
    }
  };

  const fromIso = React.useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
  const toIso = React.useMemo(() => new Date(`${to}T23:59:59.999`).toISOString(), [to]);

  const { data: rows = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['activity-pings', fromIso, toIso],
    queryFn: async () => {
      const all: PingRow[] = [];
      const pageSize = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await (supabaseCloud as any)
          .from('app_activity_pings')
          .select('user_id, email, display_name, path, tab, seconds, occurred_at')
          .gte('occurred_at', fromIso)
          .lte('occurred_at', toIso)
          .order('occurred_at', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const chunk = (data ?? []) as PingRow[];
        all.push(...chunk);
        if (chunk.length < pageSize) break;
        offset += pageSize;
      }
      return all;
    },
  });

  const summary = React.useMemo(() => {
    const users = new Map<
      string,
      {
        user_id: string;
        label: string;
        total: number;
        last: string;
        pages: Map<string, { total: number; tabs: Map<string, number> }>;
      }
    >();

    rows.forEach((r) => {
      const label = r.display_name || r.email || r.user_id.slice(0, 8);
      let u = users.get(r.user_id);
      if (!u) {
        u = { user_id: r.user_id, label, total: 0, last: r.occurred_at, pages: new Map() };
        users.set(r.user_id, u);
      }
      u.total += r.seconds;
      if (r.occurred_at > u.last) u.last = r.occurred_at;
      let p = u.pages.get(r.path);
      if (!p) {
        p = { total: 0, tabs: new Map() };
        u.pages.set(r.path, p);
      }
      p.total += r.seconds;
      const tabName = r.tab || '(fără tab)';
      p.tabs.set(tabName, (p.tabs.get(tabName) ?? 0) + r.seconds);
    });

    return Array.from(users.values())
      .filter((u) => u.label.toLowerCase().includes(search.trim().toLowerCase()))
      .sort((a, b) => b.total - a.total);
  }, [rows, search]);

  const grandTotal = summary.reduce((s, u) => s + u.total, 0);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="container mx-auto px-2 md:px-6 py-3 md:py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Activitate utilizatori</h1>
          <p className="text-muted-foreground">
            Timp petrecut în aplicație, pe fiecare hub și pe fiecare tab.
          </p>
        </div>
        <BackToHubButton />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Perioadă</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={preset === p.key ? 'default' : 'outline'}
                onClick={() => applyPreset(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">De la</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset('custom');
                  setFrom(e.target.value);
                }}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Până la</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset('custom');
                  setTo(e.target.value);
                }}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <Label className="text-xs">Caută utilizator</Label>
              <Input
                placeholder="nume sau email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              Reîmprospătează
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Utilizatori activi
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Timp total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(grandTotal)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Utilizator</TableHead>
                <TableHead className="text-right">Timp total</TableHead>
                <TableHead className="hidden md:table-cell">Ultima activitate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Se încarcă…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && summary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nicio activitate înregistrată în perioada selectată.
                  </TableCell>
                </TableRow>
              )}
              {summary.map((u) => {
                const isOpen = expanded.has(u.user_id);
                const pages = Array.from(u.pages.entries()).sort((a, b) => b[1].total - a[1].total);
                return (
                  <React.Fragment key={u.user_id}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(u.user_id)}>
                      <TableCell>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{u.label}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatDuration(u.total)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {new Date(u.last).toLocaleString('ro-RO')}
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/40 p-4">
                          <div className="space-y-3">
                            {pages.map(([path, info]) => {
                              const tabs = Array.from(info.tabs.entries()).sort(
                                (a, b) => b[1] - a[1],
                              );
                              const pct = u.total ? Math.round((info.total / u.total) * 100) : 0;
                              return (
                                <div key={path} className="rounded-md border bg-background p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium">{labelForPath(path)}</span>
                                    <span className="text-sm">
                                      {formatDuration(info.total)}{' '}
                                      <span className="text-muted-foreground">({pct}%)</span>
                                    </span>
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {tabs.map(([tab, sec]) => (
                                      <div
                                        key={tab}
                                        className="flex items-center justify-between text-sm text-muted-foreground"
                                      >
                                        <span className="pl-3">• {tab}</span>
                                        <span>{formatDuration(sec)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityTrackingPage;
