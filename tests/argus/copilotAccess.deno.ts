import { answerCopilot, copilotResponse } from "../../supabase/functions/argus/copilot.ts";
import { readTools } from "../../supabase/functions/argus/readTools.ts";

Deno.test("Viziune exposes the same operational and Senior read tools, never writes", () => {
  const c = { cloud: {}, legacy: {}, legacyUser: {} } as Parameters<typeof readTools>[0];
  const names = Object.keys(readTools(c));
  for (const name of ["schema_context", "metrici_perioada", "interogare_date", "senior_cauta_tabele", "senior_descrie_tabel", "senior_sql", "dosar_produs", "calculeaza_pret", "cauta_conversatii", "citeste_istoric"]) {
    if (!names.includes(name)) throw new Error(`Missing read tool: ${name}`);
  }
  for (const name of ["propune_actiune", "creeaza_agent", "memoreaza"]) {
    if (names.includes(name)) throw new Error(`Write tool exposed: ${name}`);
  }
  if (typeof answerCopilot !== "function") throw new Error("Copilot unavailable");
});

Deno.test("consumption aggregation reads all source pages before the output limit", async () => {
  const rows = Array.from({ length: 1201 }, () => ({ inventory_item_id: "rucola", quantity: 2 }));
  const ranges: number[][] = [];
  const legacy = { from: () => ({ select: () => ({ range: async (from: number, to: number) => {
    ranges.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  } }) }) };
  const c = { cloud: {}, legacy, legacyUser: {} } as unknown as Parameters<typeof readTools>[0];
  const tool = readTools(c).interogare_date;
  const value = await tool.execute?.({ tabel: "stock_transfer_items", coloane: ["inventory_item_id", "quantity"], filtre: [], ordonare: null, descrescator: false, grupare: ["inventory_item_id"], sume: ["quantity"], limita: 1 }, { toolCallId: "consumption", messages: [], context: {} });
  if (!value || !("randuri" in value) || !value.randuri) throw new Error(JSON.stringify(value));
  if (value.total_randuri_sursa !== 1201 || value.randuri[0]?.suma_quantity !== 2402) throw new Error("Consumption was truncated");
  if (ranges.length < 2) throw new Error("Source was not paginated");
});

Deno.test("heartbeat response is still valid JSON for the existing voice panel", async () => {
  const response = copilotResponse(async () => ({ answer: "100 kg/zi" }), {});
  const value = await response.json();
  if (value.answer !== "100 kg/zi") throw new Error("Invalid response");
});

Deno.test("permanent memory failure stops the analysis instead of hiding confirmed rules", async () => {
  const cloud = { from: () => {
    const builder = { select: () => builder, order: () => builder, range: async () => ({ data: null, error: { message: "Memory unavailable" } }) };
    return builder;
  } };
  const c = { cloud, legacy: {}, legacyUser: {} } as unknown as Parameters<typeof answerCopilot>[0];
  let failed = false;
  try { await answerCopilot(c, { question: "Care e media?", snapshot: "{}", history: [], lineIds: [] }); }
  catch (e) { failed = e instanceof Error && e.message.includes("Memory unavailable"); }
  if (!failed) throw new Error("Unavailable memory was treated as empty");
});