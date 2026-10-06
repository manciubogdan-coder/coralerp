import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PROMPT = `Ești un extractor de comenzi de la clienți (retail RO: METRO, Carrefour, Auchan, Selgros, Mega Image, Kaufland, Lidl, Nuti, eMAG etc.) către furnizorul CORAL BIOGREENS (salate, verdețuri, plante aromate).
Extrage TOATE liniile de produs cu cantitate > 0. Returnează JSON strict:
{"client":"nume scurt client cu majuscule, ex METRO, CARREFOUR, AUCHAN, SELGROS, MEGA IMAGE, KAUFLAND, LIDL, NUTI","nr_comanda":"...","data_livrare":"YYYY-MM-DD sau null",
"linii":[{"depozit":"depozit/platformă/magazin dacă documentul are mai multe, altfel null","nr_comanda":"nr comandă dacă diferă pe linii, altfel null","produs":"denumire produs curată, fără prefixe de client și fără gramaj, ex RUCOLA, BABY SPANAC, SALATA ARMONIA, BUSUIOC","gramaj":număr în grame sau null,"bucati":număr BUCĂȚI (dacă documentul dă doar baxuri/colete, înmulțește cu buc/bax),"buc_bax":număr sau null}]}
Dacă un produs apare pentru mai multe depozite, fă câte o linie per depozit. Nu inventa.`;

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

    const content: any[] = [{ type: "text", text: `Fișier: ${fileName}\n\nText extras:\n${text || "(fără text — vezi imaginile)"}` }];
    for (const img of images) content.push({ type: "image_url", image_url: { url: img } });

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: PROMPT }, { role: "user", content }],
      }),
    });
    if (r.status === 429) return json({ error: "Prea multe cereri, încearcă peste un minut" }, 429);
    if (r.status === 402) return json({ error: "Credit AI epuizat" }, 402);
    if (!r.ok) return json({ error: `AI: ${r.status} ${await r.text()}` }, 500);
    const d = await r.json();
    let raw: string = d.choices?.[0]?.message?.content ?? "{}";
    raw = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return json(JSON.parse(raw));
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
