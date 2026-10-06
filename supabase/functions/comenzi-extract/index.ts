import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROMPT = `Ești un extractor de comenzi de la clienți (retail RO: METRO, Carrefour, Auchan, Selgros, Mega Image, Kaufland, Lidl, Nuti, eMAG etc.) către furnizorul CORAL BIOGREENS (salate, verdețuri, plante aromate).
Extrage TOATE liniile de produs cu cantitate > 0 și returnează JSON conform schemei.
- client: nume scurt cu majuscule (METRO, CARREFOUR, AUCHAN, SELGROS, MEGA IMAGE, KAUFLAND, LIDL, NUTI...)
- data_livrare: YYYY-MM-DD sau null
- produs: denumire curată fără prefix de client și fără gramaj (ex RUCOLA, BABY SPANAC, SALATA ARMONIA, BUSUIOC)
- gramaj: grame sau null
- bucati: număr BUCĂȚI (dacă documentul dă doar baxuri/colete, înmulțește cu buc/bax)
- depozit: depozit/platformă/magazin dacă documentul are mai multe, altfel null; câte o linie per depozit.
Nu inventa.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["client", "nr_comanda", "data_livrare", "linii"],
  properties: {
    client: { type: "string" },
    nr_comanda: { type: ["string", "null"] },
    data_livrare: { type: ["string", "null"] },
    linii: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["depozit", "nr_comanda", "produs", "gramaj", "bucati", "buc_bax"],
        properties: {
          depozit: { type: ["string", "null"] },
          nr_comanda: { type: ["string", "null"] },
          produs: { type: "string" },
          gramaj: { type: ["number", "null"] },
          bucati: { type: "number" },
          buc_bax: { type: ["number", "null"] },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const body = await req.json();
    const text: string = typeof body?.text === "string" ? body.text.slice(0, 60000) : "";
    const images: string[] = Array.isArray(body?.images) ? body.images.slice(0, 8).filter((x: unknown) => typeof x === "string") : [];
    const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 200) : "";
    if (!text && !images.length) return json({ error: "Fișier gol" }, 400);
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "LOVABLE_API_KEY lipsește" }, 500);

    const content: any[] = [{ type: "input_text", text: `Fișier: ${fileName}\n\nText extras:\n${text || "(fără text — vezi imaginile)"}` }];
    for (const img of images) content.push({ type: "input_image", image_url: img });

    const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: PROMPT,
        input: [{ role: "user", content }],
        text: { format: { type: "json_schema", name: "comanda", strict: true, schema: SCHEMA } },
      }),
    });
    if (r.status === 429) return json({ error: "Prea multe cereri, încearcă peste un minut" }, 429);
    if (r.status === 402) return json({ error: "Credit AI epuizat" }, 402);
    if (!r.ok || !r.body) return json({ error: `AI: ${r.status} ${await r.text()}` }, 500);

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "", out = "", done = "";
    while (true) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const p = line.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
          else if (ev.type === "response.output_text.done") done = ev.text ?? "";
          else if (ev.type === "response.failed" || ev.type === "error") return json({ error: "AI a eșuat" }, 500);
        } catch { /* ignore */ }
      }
    }
    return json(JSON.parse(done || out || "{}"));
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
