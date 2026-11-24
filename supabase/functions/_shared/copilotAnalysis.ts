// Pure read-tool loop: transport is injected so data access can be regression-tested.
export type AnalysisBlock = { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export interface AnalysisMessage { role: "user" | "assistant"; content: string | AnalysisBlock[] }
export interface AnalysisTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (input: Record<string, unknown>, id: string) => Promise<unknown>;
}
export interface AnalysisReply { content: AnalysisBlock[]; stop_reason?: string | null }
export type AnalysisTransport = (messages: AnalysisMessage[], final: boolean) => Promise<AnalysisReply>;

/** Only the supplied read tools may run; never replay writes or client-provided tool results. */
export async function runCopilotAnalysis(messages: AnalysisMessage[], tools: AnalysisTool[], send: AnalysisTransport, compact: (value: unknown) => string): Promise<string> {
  const history = [...messages];
  const registry = new Map(tools.map(t => [t.name, t]));
  for (let step = 0; step <= 22; step++) {
    const final = step === 22;
    const reply = await send(history, final);
    if (reply.stop_reason === "refusal") throw new Error("Argus nu poate răspunde acestei cereri.");
    if (reply.stop_reason === "max_tokens") throw new Error("Analiza a fost întreruptă înainte de un răspuns complet. Restrânge întrebarea.");
    const calls = reply.content.filter(b => b.type === "tool_use");
    if (!calls.length) {
      const text = reply.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
      if (!text) throw new Error("Argus nu a formulat un răspuns.");
      return text;
    }
    if (final) throw new Error("Analiza nu s-a încheiat. Restrânge perioada sau produsul.");
    history.push({ role: "assistant", content: reply.content });
    const results: AnalysisBlock[] = [];
    // Senior shares one queue: sequential calls avoid flooding the live reader.
    for (const call of calls) {
      const t = registry.get(call.name);
      try {
        if (!t) throw new Error("Instrument indisponibil: Viziune permite numai citirea datelor.");
        results.push({ type: "tool_result", tool_use_id: call.id, content: compact(await t.execute(call.input, call.id)) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: call.id, content: compact({ eroare: e instanceof Error ? e.message : "Citirea a eșuat." }), is_error: true });
      }
    }
    history.push({ role: "user", content: results });
  }
  throw new Error("Argus nu a formulat un răspuns.");
}