import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageResponse } from "@/components/ai-elements/message";

export type ArgusContent = {
  widget_type: string;
  title?: string;
  summary?: string;
  kpi_data?: { value?: string; unit?: string; trend?: string | null; is_positive?: boolean };
  chart_data?: Record<string, any>[];
  chart_config?: { xAxisKey?: string; series?: { key: string; label?: string; color?: string }[] };
  table_data?: { headers?: string[]; rows?: any[][] };
  markdown_text?: string;
};

const PALETTE = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#06b6d4", "#84cc16", "#ec4899"];

function series(c: ArgusContent) {
  const s = c.chart_config?.series;
  if (s?.length) return s;
  const first = c.chart_data?.[0] ?? {};
  const x = c.chart_config?.xAxisKey ?? "name";
  return Object.keys(first).filter((k) => k !== x && typeof first[k] === "number").map((key) => ({ key, label: key }));
}

export default function ArgusWidgetRenderer({ content }: { content: ArgusContent }) {
  const x = content.chart_config?.xAxisKey ?? "name";
  const data = content.chart_data ?? [];
  const ser = series(content);
  let body: React.ReactNode = null;

  switch (content.widget_type) {
    case "bar_chart":
    case "line_chart":
      body = (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            {content.widget_type === "bar_chart" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey={x} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
                {ser.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={s.color ?? PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey={x} fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
                {ser.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key} stroke={s.color ?? PALETTE[i % PALETTE.length]} strokeWidth={2} />)}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      );
      break;
    case "pie_chart": {
      const k = ser[0]?.key ?? "value";
      body = (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey={k} nameKey={x} outerRadius={85} label={{ fontSize: 11 }}>
                {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
      break;
    }
    case "kpi": {
      const k = content.kpi_data ?? {};
      body = (
        <div className="flex flex-col items-start gap-1 py-4">
          <div className="text-4xl font-bold tracking-tight">{k.value ?? "—"}</div>
          {k.unit && <div className="text-sm text-muted-foreground">{k.unit}</div>}
          {k.trend && (
            <div className={`mt-1 flex items-center gap-1 text-sm font-medium ${k.is_positive ? "text-emerald-600" : "text-destructive"}`}>
              {k.is_positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{k.trend}
            </div>
          )}
        </div>
      );
      break;
    }
    case "table":
      body = (
        <div className="max-h-72 overflow-auto rounded border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted">
              <TableRow>{(content.table_data?.headers ?? []).map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {(content.table_data?.rows ?? []).map((r, i) => (
                <TableRow key={i}>{r.map((v, j) => <TableCell key={j} className="py-1.5">{String(v ?? "")}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
      break;
    default:
      body = <div className="prose prose-sm max-h-72 max-w-none overflow-y-auto dark:prose-invert"><MessageResponse>{content.markdown_text ?? content.summary ?? ""}</MessageResponse></div>;
  }

  return (
    <div className="space-y-3">
      {body}
      {content.summary && content.widget_type !== "markdown" && <p className="border-t pt-2 text-xs text-muted-foreground">{content.summary}</p>}
    </div>
  );
}
