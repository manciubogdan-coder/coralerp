import { generateText, isStepCount, jsonSchema, tool } from "npm:ai@7.0.123";
import { addDays, bucharestDay, overviewWithTrend, runQuery, TABLES, type Clients, type QuerySpec } from "./data.ts";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const WIDGETS = ["bar_chart", "line_chart", "pie_chart", "kpi", "table", "markdown"];

const tableList = Object.entries(TABLES).map(([k, v]) => `- ${k}: ${v.desc}`).join("\n");

export function agentTools(c: Clients, querySchema: unknown) {
  return {
    metrici_perioada: tool({
      description: "Tablou complet pe o perioadă (oameni, producție, depozite, anomalii, rebut, calitate).",
      inputSchema: jsonSchema<{ de_la: string; pana_la: string }>({
        type: "object", additionalProperties: false, required: ["de_la", "pana_la"],
        properties: { de_la: { type: "string" }, pana_la: { type: "string" } },
      }),
      execute: async ({ de_la, pana_la }) => {
        if (!DAY_RE.test(de_la) || !DAY_RE.test(pana_la)) return { eroare: "Date invalide" };
        try {
          const o: any = await overviewWithTrend(c, de_la, pana_la);
          o.calitate.probleme = o.calitate.probleme.slice(0, 30).map(({ poze, ...x }: any) => ({ ...x, poze: poze.length }));
          for (const k of Object.keys(o.depozite)) delete o.depozite[k].lista;
          o.rebut.inregistrari = o.rebut.inregistrari.slice(0, 30);
          return o;
        } catch (e) { return { eroare: String((e as Error).message) }; }
      },
    }),
    interogare_date: tool({
      description: "Interogare doar-citire pe un tabel, cu filtre, grupare și sume.",
      inputSchema: jsonSchema<QuerySpec>(querySchema as any),
      execute: async (spec) => {
        try {
          const r = await runQuery(c, spec);
          const lim = Math.min(Math.max(1, spec.limita || 50), 150);
          return { total_randuri_sursa: r.total_randuri_sursa, randuri: r.randuri.slice(0, lim) };
        } catch (e) { return { eroare: String((e as Error).message) }; }
      },
    }),
  };
}

export async function runAgent(c: Clients, model: any, querySchema: unknown, t: any, executionType: "manual" | "cron") {
  const { data: rep } = await c.cloud.from("argus_generated_reports")
    .insert({ template_id: t.id, status: "pending", execution_type: executionType }).select("id").single();
  const today = bucharestDay();
  const pref = t.preferred_widget_type && t.preferred_widget_type !== "auto" ? `Folosește OBLIGATORIU widget_type="${t.preferred_widget_type}".` : "Alege widget_type-ul cel mai potrivit.";
  try {
    const instructions = `Ești Argus, analistul de date al Coral Biogreens. Azi este ${today} (Europe/Bucharest), ieri a fost ${addDays(today, -1)}.
Folosește instrumentele ca să calculezi cifre REALE; nu inventa nimic. Fă cât mai puține interogări (ideal o singură interogare agregată). Tabele disponibile:
${tableList}
La final răspunde DOAR cu un obiect JSON valid (fără text înainte/după, fără \`\`\`), în română, cu structura:
{"widget_type": ${WIDGETS.map((w) => `"${w}"`).join("|")}, "title": str, "summary": str scurt (max 25 cuvinte),
 "kpi_data": {"value": str, "unit": str, "trend": str|null, "is_positive": bool} (pentru kpi),
 "chart_data": [{"name": str, "<serie>": number}] (pentru grafice, max 30 puncte),
 "chart_config": {"xAxisKey": "name", "series": [{"key": str, "label": str, "color": "#hex"}]},
 "table_data": {"headers": [str], "rows": [[str]]} (pentru tabel, max 50 rânduri),
 "markdown_text": str (pentru markdown)}
Pentru pie_chart folosește o singură serie. ${pref}`;
    const res = await generateText({
      model,
      tools: agentTools(c, querySchema),
      stopWhen: isStepCount(50),
      instructions,
      prompt: `Agent: ${t.title}\n${t.description ?? ""}\nInstrucțiuni: ${t.prompt_instructions}`,
    });
    const extract = (txt: string) => {
      const raw = (txt ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
      if (s < 0 || e < 0) return null;
      try { return JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
    };
    let content = extract(res.text);
    if (!content) {
      // Model stopped after tool calls or wrote prose: ask once more, no tools, for the final JSON.
      const fin = await generateText({
        model,
        instructions,
        messages: [
          { role: "user", content: `Agent: ${t.title}\nInstrucțiuni: ${t.prompt_instructions}` },
          ...(res.response?.messages ?? []),
          { role: "user", content: "Pe baza datelor obținute mai sus, răspunde ACUM doar cu obiectul JSON final cerut." },
        ] as any,
      });
      content = extract(fin.text);
      if (!content && fin.text?.trim()) content = { widget_type: "markdown", title: t.title, markdown_text: fin.text.trim() };
      if (!content && res.text?.trim()) content = { widget_type: "markdown", title: t.title, markdown_text: res.text.trim() };
    }
    if (!content) throw new Error("Argus nu a returnat date structurate.");
    if (!WIDGETS.includes(content.widget_type)) content.widget_type = "markdown";
    await c.cloud.from("argus_generated_reports").update({ status: "completed", content_json: content, executed_at: new Date().toISOString() }).eq("id", rep!.id);
    return { ok: true as const };
  } catch (e) {
    const status = (e as any)?.statusCode ?? (e as any)?.status;
    await c.cloud.from("argus_generated_reports").update({ status: "failed", error: String((e as Error).message ?? e).slice(0, 500) }).eq("id", rep!.id);
    return { ok: false as const, status };
  }
}

/** Is a scheduled template due today (Bucharest)? */
export function isDue(t: any, now = new Date()) {
  if (t.schedule_type === "on_demand") return false;
  const today = bucharestDay(now);
  const last = t.last_scheduled_at ? bucharestDay(new Date(t.last_scheduled_at)) : null;
  if (last === today) return false;
  if (t.schedule_type === "daily") return true;
  const d = new Date(`${today}T12:00:00Z`);
  if (t.schedule_type === "weekly") return d.getUTCDay() === 1 || !last || addDays(last, 7) <= today;
  if (t.schedule_type === "monthly") return today.endsWith("-01") || !last || addDays(last, 31) <= today;
  return false;
}
