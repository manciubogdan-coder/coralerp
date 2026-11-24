import { describe, it, expect } from "vitest";
import { buildLines } from "@/lib/viziune/factoryState";
import { copilotSnapshot, factorySummary, tourStops, type FactoryInput } from "@/lib/viziune/presentation";
import { cleanCopilotRequest, parseCopilotReply, COPILOT_LIMITS } from "../../supabase/functions/_shared/viziuneCopilotRules";

const T0 = Date.parse("2026-11-24T06:00:00Z");
const at = (min: number) => new Date(T0 + min * 60_000).toISOString();
const lines = [{ id: "L1", nume: "Salate 1", status: "activ", capacitate_ora: 120 }, { id: "L2", nume: "Aromate", status: "activ", capacitate_ora: 600 }];
const orders = [
  { id: "a", linie_id: "L1", status: "in_progress", cantitate: 100, magazin: "Lidl", productie_produse: { nume: "Salata" } },
  { id: "b", linie_id: "L2", status: "completed", cantitate: 300, cantitate_produsa_sesiuni: 300, magazin: "Metro", productie_produse: { nume: "Busuioc" } },
  { id: "c", linie_id: "L2", status: "assigned", cantitate: 50, magazin: "PRODUCTIE_AVANS", productie_produse: { nume: "Avans" } },
];
const sessions = [{ id: "s1", comanda_id: "a", linie_id: "L1", ora_start: at(0), ora_sfarsit: null, status: "activa", nume_operator: "Ana", numar_angajati: 5 }];
const input = (now = T0 + 65 * 60_000): FactoryInput => ({
  now, orders, lineViews: buildLines(lines, orders, sessions, now),
  receptions: [{ supplier: "Magnani", kg: 1200, lots: 3 }], prereceptions: [], ready: [{ store: "Metro", pieces: 300, orders: 1 }],
  stock: [{ name: "Rucola", qty: 500, unit: "kg" }], unassigned: 0, offices: { online: 4, seniorDocs: 37 },
});

describe("Viziune prezentare: cifrele zilei", () => {
  it("counts only real customer orders, never advance production", () => {
    const s = factorySummary(input());
    expect(s.pieces).toBe(400);
    expect(s.produced).toBe(300);
    expect(s.pct).toBe(75);
    expect(s.orders).toBe(2);
  });

  it("shows the most late line in the tour (100 buc at 120/h = 50 min, worked 65 → 15 min over)", () => {
    const s = factorySummary(input());
    expect(s.late).toEqual([{ id: "L1", name: "Salate 1", lateMinutes: 15 }]);
    const stop = tourStops(s, (id) => (id === "L1" ? "Salate 1" : null)).find((x) => x.key === "linie")!;
    expect(stop.camera).toEqual({ line: "L1" });
    expect(stop.facts[0]).toBe("Peste normă cu 15 minute");
  });

  it("tour starts and ends on the whole factory", () => {
    const st = tourStops(factorySummary(input()));
    expect(st[0].camera).toEqual({ zone: "all" });
    expect(st[st.length - 1].camera).toEqual({ zone: "all" });
  });

  it("the copilot sees each line with its id, so it can fly the camera there", () => {
    const snap = copilotSnapshot(input(), factorySummary(input()));
    expect(snap.linii.map((l) => l.id)).toEqual(["L1", "L2"]);
    expect(snap.linii[0].minute_peste_norma).toBe(15);
    expect(snap.total.bucati_planificate_azi).toBe(400);
  });
});

describe("Argus în Viziune: răspuns și țintă", () => {
  it("keeps a target only if it is a real line or a known zone", () => {
    expect(parseCopilotReply('{"raspuns":"Salate 1 e în urmă.","tinta":{"tip":"linie","id":"L1"}}', ["L1"]).target).toEqual({ kind: "line", id: "L1" });
    expect(parseCopilotReply('{"raspuns":"x","tinta":{"tip":"linie","id":"L9"}}', ["L1"]).target).toBeNull();
    expect(parseCopilotReply('{"raspuns":"x","tinta":{"tip":"zona","id":"receptie"}}', []).target).toEqual({ kind: "zone", id: "receptie" });
    expect(parseCopilotReply('{"raspuns":"x","tinta":{"tip":"zona","id":"acoperis"}}', []).target).toBeNull();
  });

  it("a reply that is not JSON is still spoken as text", () => {
    expect(parseCopilotReply("Producția e la 75%.", []).answer).toBe("Producția e la 75%.");
  });

  it("rejects an empty question and caps the history", () => {
    expect(() => cleanCopilotRequest({ question: "  " })).toThrow();
    const r = cleanCopilotRequest({ question: "Cum stăm?", snapshot: { linii: [{ id: "L1" }] }, history: Array.from({ length: 20 }, (_, i) => ({ role: "user", text: `q${i}` })) });
    expect(r.history).toHaveLength(COPILOT_LIMITS.history);
    expect(r.lineIds).toEqual(["L1"]);
  });
});
