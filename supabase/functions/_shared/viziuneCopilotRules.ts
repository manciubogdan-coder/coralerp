// Argus copilot inside Viziune (3D factory): request limits, prompt and reply parsing.
// Pure, no Deno/React: shared by the argus edge function and the tests.

/** Places the copilot may fly the camera to (keys of the scene's ZONES). */
export const COPILOT_ZONES = [
  "all", "productie", "cantare", "spalare", "receptie", "depozit", "livrare", "birouri", "birouriHala", "birouDepozit",
] as const;
export type CopilotZone = typeof COPILOT_ZONES[number];
export type CopilotTarget = { kind: "line"; id: string } | { kind: "zone"; id: CopilotZone } | null;

export const COPILOT_LIMITS = { question: 600, snapshot: 40_000, history: 6, historyText: 800, audioBytes: 4_000_000, voiceText: 900 };

export interface CopilotTurn { role: "user" | "assistant"; text: string }
export interface CopilotRequest { question: string; snapshot: string; history: CopilotTurn[]; lineIds: string[] }

const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Validates what the browser sends: a question, the live factory picture and the last few turns. */
export function cleanCopilotRequest(body: unknown): CopilotRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const question = str(b.question, COPILOT_LIMITS.question);
  if (!question) throw new Error("Spune sau scrie o întrebare.");
  const snap = b.snapshot && typeof b.snapshot === "object" ? b.snapshot as Record<string, unknown> : {};
  const snapshot = JSON.stringify(snap);
  if (snapshot.length > COPILOT_LIMITS.snapshot) throw new Error("Imaginea fabricii e prea mare.");
  const lines = Array.isArray(snap.linii) ? snap.linii as Record<string, unknown>[] : [];
  const lineIds = lines.map((l) => String(l?.id ?? "")).filter(Boolean);
  const history = (Array.isArray(b.history) ? b.history : []).slice(-COPILOT_LIMITS.history)
    .map((t: any) => ({ role: t?.role === "assistant" ? "assistant" : "user", text: str(t?.text, COPILOT_LIMITS.historyText) }) as CopilotTurn)
    .filter((t) => t.text);
  return { question, snapshot, history, lineIds };
}

export function copilotInstructions(now: string): string {
  return `Ești **Argus**, asistentul fabricii Coral Biogreens (verdețuri și salate proaspete ambalate pentru retaileri). Ești pe ecranul „Viziune” — fabrica 3D vie — și răspunzi cu voce, de obicei în fața unui public.
Acum: ${now} (ora României).
Primești imaginea LIVE a fabricii (JSON): linii de producție cu comenzi, bucăți, oameni, normă și întârzieri; recepții de azi; camioane așteptate (prerecepții); stocul depozitului de materie primă; magazinele cu marfă gata de livrare; birourile.
Reguli:
- Răspunzi în română, natural, ca la microfon: 1–3 propoziții scurte, maxim ~55 de cuvinte. Fără liste, fără markdown, fără emoji, fără ID-uri.
- Folosești DOAR cifrele din JSON; rotunjește-le cum le-ar spune un om („aproape 12 mii de bucăți”). Dacă ceva nu e în date, spune scurt că nu vezi asta aici, fără să inventezi.
- Spune lucrurile direct, inclusiv problemele (linii peste normă, camioane întârziate).
- Alege unde să zboare camera, ca publicul să vadă ce spui: o linie (după "id" din linii) sau o zonă: ${COPILOT_ZONES.join(", ")} (all = toată fabrica, productie = hala, receptie = poarta și camioanele, depozit = depozitul de materie primă, livrare = picking și expediție, birouri = clădirea de birouri).
Răspunde DOAR cu JSON: {"raspuns": "...", "tinta": {"tip": "linie"|"zona", "id": "..."} sau null}`;
}

/** Reads the model reply; a target outside the snapshot's lines or the known zones is dropped, never guessed. */
export function parseCopilotReply(text: string, lineIds: string[]): { answer: string; target: CopilotTarget } {
  const raw = String(text ?? "").trim();
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  let parsed: any = null;
  if (s >= 0 && e > s) { try { parsed = JSON.parse(raw.slice(s, e + 1)); } catch { parsed = null; } }
  const answer = str(parsed ? parsed.raspuns ?? parsed.answer : raw.replace(/```[a-z]*|```/g, ""), 1200);
  const t = parsed?.tinta ?? parsed?.target ?? null;
  const id = String(t?.id ?? "");
  let target: CopilotTarget = null;
  if (t && (t.tip === "linie" || t.kind === "line") && lineIds.includes(id)) target = { kind: "line", id };
  else if (t && (t.tip === "zona" || t.kind === "zone") && (COPILOT_ZONES as readonly string[]).includes(id)) target = { kind: "zone", id: id as CopilotZone };
  return { answer: answer || "Nu am reușit să formulez un răspuns. Mai întreabă o dată.", target };
}

/** Text sent to the voice: plain speech, no markdown, capped. */
export function voiceText(text: unknown): string {
  return String(text ?? "").replace(/[*_#`>|]/g, "").replace(/\s+/g, " ").trim().slice(0, COPILOT_LIMITS.voiceText);
}
