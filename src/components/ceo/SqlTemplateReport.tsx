import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Play } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

export interface TemplateParam { name: string; label: string; type: 'date' | 'text' | 'number' }
export interface SqlTemplate {
  kind: 'sql';
  sql: string;
  params: TemplateParam[];
  defaults: Record<string, string>;
  chart: 'table' | 'bar' | 'line' | 'pie';
  x: string | null;
  series: string[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 60% 40%)', 'hsl(38 90% 50%)', 'hsl(200 70% 45%)', 'hsl(280 50% 55%)'];
const fmt = (v: unknown) =>
  typeof v === 'number' ? v.toLocaleString('ro-RO', { maximumFractionDigits: 2 })
    : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && v.length < 16 ? Number(v).toLocaleString('ro-RO', { maximumFractionDigits: 2 })
    : v == null ? '' : String(v);

/** Parameter inputs (dates, supplier/client names) for a saved or suggested report template. */
export const TemplateParamsForm: React.FC<{
  template: SqlTemplate;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onRun: () => void;
  busy?: boolean;
}> = ({ template, values, onChange, onRun, busy }) => {
  if (!template.params.length) {
    return <Button size="sm" variant="outline" onClick={onRun} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Rulează din nou</Button>;
  }
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); onRun(); }}>
      {template.params.map((p) => (
        <label key={p.name} className="text-xs space-y-1">
          <span className="block text-muted-foreground">{p.label}</span>
          <Input
            className="h-9 w-44"
            type={p.type === 'date' ? 'date' : p.type === 'number' ? 'number' : 'text'}
            placeholder={p.type === 'text' ? 'gol = toți' : undefined}
            value={values[p.name] ?? ''}
            onChange={(e) => onChange({ ...values, [p.name]: e.target.value })}
          />
        </label>
      ))}
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />} Rulează
      </Button>
    </form>
  );
};

/** Rows from a template query: chart when the template asks for one, otherwise a table. */
export const SqlResultView: React.FC<{ template: SqlTemplate; rows: any[] }> = ({ template, rows }) => {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-6 text-center">Niciun rezultat pentru filtrele alese.</p>;
  const cols = Object.keys(rows[0]);
  const x = template.x && cols.includes(template.x) ? template.x : null;
  const series = template.series.filter((s) => cols.includes(s));
  const chart = x && series.length ? template.chart : 'table';
  const table = (
    <div className="max-h-[50vh] overflow-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0"><tr>{cols.map((k) => <th key={k} className="text-left p-2 whitespace-nowrap">{k}</th>)}</tr></thead>
        <tbody>
          {rows.slice(0, 500).map((r, i) => (
            <tr key={i} className="border-t">{cols.map((k) => <td key={k} className={`p-2 whitespace-nowrap ${typeof r[k] === 'number' ? 'text-right' : ''}`}>{fmt(r[k])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  if (chart === 'table') return table;
  const data = rows.slice(0, 60).map((r) => ({ name: String(r[x!] ?? '—'), ...Object.fromEntries(series.map((s) => [s, Number(r[s]) || 0])) }));
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        {chart === 'pie' ? (
          <PieChart>
            <Pie data={data.slice(0, 12)} dataKey={series[0]} nameKey="name" outerRadius={110} label={(e) => e.name}>
              {data.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} />
          </PieChart>
        ) : chart === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString('ro-RO', { notation: 'compact' })} />
            <Tooltip formatter={(v: number) => fmt(v)} /><Legend />
            {series.map((s, i) => <Line key={s} dataKey={s} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} />)}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => Number(v).toLocaleString('ro-RO', { notation: 'compact' })} />
            <Tooltip formatter={(v: number) => fmt(v)} /><Legend />
            {series.map((s, i) => <Bar key={s} dataKey={s} fill={COLORS[i % COLORS.length]} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
      {table}
    </div>
  );
};
