import { test, expect } from "bun:test";
import { runCopilotAnalysis, type AnalysisMessage, type AnalysisTool } from "../../supabase/functions/_shared/copilotAnalysis";

const compact = (v: unknown) => JSON.stringify(v);
const query = (name: string, execute: AnalysisTool["execute"]): AnalysisTool => ({ name, description: name, input_schema: { type: "object" }, execute });
const result = (messages: AnalysisMessage[]) => {
  const content = messages.at(-1)?.content;
  if (!Array.isArray(content)) throw new Error("Lipsesc rezultatele citirii");
  const block = content.find(b => b.type === "tool_result");
  if (!block || block.type !== "tool_result") throw new Error("Lipsește rezultatul instrumentului");
  return JSON.parse(block.content);
};

test("historical consumption is read even when the screen only contains today's stock", async () => {
  let reads = 0, steps = 0;
  const tools = [query("interogare_date", async input => {
    expect(input).toEqual({ tabel: "transferuri", de_la: "2026-10-27", pana_la: "2026-11-23" });
    reads++;
    return { consum_net_kg: 2800, zile_calendaristice: 28, media_kg_zi: 100 };
  })];
  const answer = await runCopilotAnalysis([{ role: "user", content: "Stoc azi: 500 kg. Care e media de consum?" }], tools, async messages => {
    if (steps++ === 0) return { content: [{ type: "tool_use", id: "q1", name: "interogare_date", input: { tabel: "transferuri", de_la: "2026-10-27", pana_la: "2026-11-23" } }] };
    return { content: [{ type: "text", text: `${result(messages).media_kg_zi} kg/zi` }], stop_reason: "end_turn" };
  }, compact);
  expect(reads).toBe(1);
  expect(answer).toBe("100 kg/zi");
});

test("Senior figures come back through the live tool, not from the scene", async () => {
  let steps = 0;
  const answer = await runCopilotAnalysis([{ role: "user", content: "Cât am facturat în octombrie?" }], [query("senior_sql", async () => ({ valoare_lei: 125000 }))], async messages => {
    if (steps++ === 0) return { content: [{ type: "tool_use", id: "s1", name: "senior_sql", input: { sql: "SELECT SUM(Total) FROM Facturi" } }] };
    return { content: [{ type: "text", text: `${result(messages).valoare_lei} lei` }] };
  }, compact);
  expect(answer).toBe("125000 lei");
});

test("the read-only registry rejects requested writes without executing them", async () => {
  let steps = 0, reads = 0;
  await runCopilotAnalysis([], [query("interogare_date", async () => { reads++; return {}; })], async messages => {
    if (steps++ === 0) return { content: [{ type: "tool_use", id: "w1", name: "propune_actiune", input: { cantitate: 1000 } }] };
    expect(result(messages).eroare).toContain("numai citirea");
    return { content: [{ type: "text", text: "Confirmă în chatul principal." }] };
  }, compact);
  expect(reads).toBe(0);
});

test("unavailable source returns an explicit tool error, not an empty result", async () => {
  let steps = 0;
  await runCopilotAnalysis([], [query("senior_sql", async () => { throw new Error("Senior indisponibil"); })], async messages => {
    if (steps++ === 0) return { content: [{ type: "tool_use", id: "s1", name: "senior_sql", input: {} }] };
    expect(result(messages)).toEqual({ eroare: "Senior indisponibil" });
    return { content: [{ type: "text", text: "Nu pot verifica Senior acum." }] };
  }, compact);
});

test("truncated SQL or output is not executed or presented as a complete answer", async () => {
  let executions = 0;
  await expect(runCopilotAnalysis([], [query("senior_sql", async () => { executions++; })], async () => ({ content: [{ type: "tool_use", id: "s1", name: "senior_sql", input: {} }], stop_reason: "max_tokens" }), compact)).rejects.toThrow("întreruptă");
  expect(executions).toBe(0);
});

test("a snapshot-only answer does not force expensive historical reads", async () => {
  let reads = 0;
  const answer = await runCopilotAnalysis([{ role: "user", content: "Producție azi: 75%. Cum stăm?" }], [query("interogare_date", async () => { reads++; })], async () => ({ content: [{ type: "text", text: "Producția este la 75%." }] }), compact);
  expect(answer).toBe("Producția este la 75%.");
  expect(reads).toBe(0);
});