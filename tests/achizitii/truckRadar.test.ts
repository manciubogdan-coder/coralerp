import { describe, it, expect } from "vitest";
import { trucks, truckLines, delayImpact, truckLight, validRadarSettings, DEFAULT_RADAR_SETTINGS, type RadarRow } from "../../src/lib/achizitii/truckRadar";

const S = DEFAULT_RADAR_SETTINGS; // order 2 days before loading, 1 day transit, Mon–Sat
const today = "2026-11-17"; // Tuesday
const row = (o: Partial<RadarRow> = {}): RadarRow => ({
  key: "r", name: "Rucola", unit: "kg", productId: "p1", snapshots: { [today]: 100 }, received: {}, returned: {},
  outbound: {}, commitments: {}, orderedPerDate: {}, transferAvg: [100, 100, 100, 100, 100, 100, 100], actualConsumption: {}, buffer: 0, ...o,
});

describe("truck radar", () => {
  it("order today is for loading the day after tomorrow, arriving one day later", () => {
    const t = trucks(S, today, "09:00").find((x) => x.phase === "azi")!;
    expect(t.loading).toBe("2026-11-19");
    expect(t.arrival).toBe("2026-11-20");
  });
  it("after the cutoff the order day is closed", () => {
    expect(trucks(S, today, "14:01").some((x) => x.phase === "azi")).toBe(false);
  });
  it("no loading on Sunday", () => {
    expect(trucks(S, today, "09:00").some((x) => x.loading === "2026-11-22")).toBe(false);
  });
  it("ordering 300 when 520 is needed is a shortage of 220", () => {
    const t = { loading: "2026-11-19", arrival: "2026-11-20", orderDay: today, deadline: "", phase: "azi" as const };
    const r = row({ snapshots: { [today]: 0 }, transferAvg: [520, 520, 520, 520, 520, 520, 520], orderedPerDate: { "2026-11-18": 1040, "2026-11-19": 520, "2026-11-20": 300 } });
    const [l] = truckLines([r], [{ id: "o", product_id: "p1", quantity: 300, delivery_date: "2026-11-20", order_date: "2026-11-16", status: "ordered" }], t, "2026-11-21", S, today);
    expect(l.need).toBeCloseTo(520);
    expect(l.delta).toBeCloseTo(-220);
    expect(l.status).toBe("lipsa");
    expect(l.premature).toBe(true);
    expect(truckLight(t, [l])).toBe("rosu");
  });
  it("a one-day late truck shows the products that run out", () => {
    const r = row({ snapshots: { [today]: 100 }, orderedPerDate: { "2026-11-18": 100 } });
    const [d] = delayImpact([r], "2026-11-18", 1, today);
    expect(d.shortage).toBeCloseTo(100);
    expect(d.firstDay).toBe("2026-11-18");
  });
  it("settings reject an invalid cutoff", () => {
    expect(() => validRadarSettings({ ...S, cutoff: "25:00" })).toThrow();
  });
});
