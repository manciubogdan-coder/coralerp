import { describe, it, expect } from "vitest";
import { trucks, truckLines, productLines, ordersAsOf, rowAsOf, delayImpact, truckLight, byRange, validRadarSettings, validRadarSettingsByType, DEFAULT_RADAR_SETTINGS, DEFAULT_RADAR_BY_TYPE, type RadarRow } from "../../src/lib/achizitii/truckRadar";

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
    expect(l.stockToday).toBe(0);
    expect(l.stockAtArrival).toBeCloseTo(0);
    expect(truckLight([l])).toBe("rosu");
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
  it("stock at arrival counts the deliveries and consumption before it", () => {
    const t = { loading: "2026-11-18", arrival: "2026-11-19", orderDay: today, deadline: "", phase: "azi" as const };
    const r = row({ snapshots: { [today]: 500 }, orderedPerDate: { "2026-11-18": 50 } });
    const [l] = truckLines([r], [{ id: "o", product_id: "p1", quantity: 100, delivery_date: "2026-11-19", order_date: today, status: "ordered" }], t, "2026-11-20", S, today);
    expect(l.stockToday).toBe(500);
    expect(l.stockAtArrival).toBeCloseTo(350); // 500 − 100 − 100 + 50
  });
  it("a past day only sees orders placed by then and consumption before it", () => {
    const day = "2026-11-10";
    const orders = [
      { id: "a", product_id: "p1", quantity: 200, delivery_date: "2026-11-12", order_date: "2026-11-09", status: "delivered" },
      { id: "b", product_id: "p1", quantity: 999, delivery_date: "2026-11-12", order_date: "2026-11-11", status: "ordered" },
      { id: "c", product_id: "p1", quantity: 50, delivery_date: "2026-11-12", order_date: "2026-11-08", status: "cancelled" },
    ];
    const act = ordersAsOf(orders, day, today, [{ order_id: "a", quantity: 150, delivery_date: "2026-11-12", status: "ordered", seen_at: "2026-11-09T10:00:00Z" }]);
    expect(act.map((o) => o.id)).toEqual(["a"]);
    expect(act[0].quantity).toBe(150);
    const r = rowAsOf(row({ actualConsumption: { "2026-11-09": 70, "2026-11-11": 900 }, received: { "2026-11-12": 200 } }), day, today, act);
    expect(r.actualConsumption["2026-11-11"]).toBeUndefined();
    expect(r.received["2026-11-12"]).toBeUndefined();
    expect(r.orderedPerDate["2026-11-12"]).toBe(150);
    expect(r.transferAvg[0]).toBeCloseTo(70 / 4); // Mondays in the 4 weeks before 10.11
  });
  it("packaging deadline follows each product's lead time (21 days vs 3 days)", () => {
    const P = DEFAULT_RADAR_BY_TYPE.ambalaje;
    const base = { snapshots: { [today]: 300 }, transferAvg: [100, 100, 100, 100, 100, 100, 100] };
    const slow = row({ ...base, key: "f", productId: "pf", name: "Folie", leadTime: 21 });
    const fast = row({ ...base, key: "c", productId: "pc", name: "Cutie", leadTime: 3 });
    const lines = productLines([slow, fast], [], P, today, "09:00", "2026-12-15");
    const f = lines.find((l) => l.key === "f")!; const c = lines.find((l) => l.key === "c")!;
    expect(f.arrival).toBe("2026-11-20"); // stock 300 − 100/day ends at 0 on 19.11, runs short on 20.11
    expect(f.orderDay).toBe("2026-10-30");
    expect(f.phase).toBe("inchis");
    expect(c.orderDay).toBe(today);
    expect(c.phase).toBe("azi");
    expect(f.status).toBe("lipsa");
    expect(truckLight([f])).toBe("rosu");
  });
  it("packaging does not warn on surplus", () => {
    const P = DEFAULT_RADAR_BY_TYPE.ambalaje;
    const r = row({ snapshots: { [today]: 0 }, orderedPerDate: { "2026-11-18": 5000 }, leadTime: 3 });
    const [l] = productLines([r], [{ id: "o", product_id: "p1", quantity: 5000, delivery_date: "2026-11-18", order_date: today, status: "ordered" }], P, today, "09:00", "2026-11-30");
    expect(l.status).toBe("ok");
  });
  it("each warehouse keeps its own rules; old saves become raw-material rules", () => {
    const s = validRadarSettingsByType({ ...S, advanceDays: 3 });
    expect(s["materii-prime"].advanceDays).toBe(3);
    expect(s.ambalaje.deadlineFrom).toBe("produs");
    expect(s.etichete.deadlineFrom).toBe("produs");
  });
  it("products are grouped by range in forecast order, unknown ranges last", () => {
    const g = byRange([{ group: "Altele" }, { group: "Aromate" }, { group: "Salate" }, { group: "Aromate" }], "materii-prime");
    expect(g.map((x) => x.group)).toEqual(["Salate", "Aromate", "Altele"]);
    expect(g[1].items.length).toBe(2);
    expect(byRange([{ group: "Cutii" }, { group: "Folie" }], "ambalaje").map((x) => x.group)).toEqual(["Folie", "Cutii"]);
  });
});

import { delayImpact as _delay } from '@/lib/achizitii/truckRadar';
import { it as _it, expect as _expect } from 'vitest';
_it('delayed truck shows the full deficit: 693.5 stock, 956.5 use → 263 kg short', () => {
  const t = '2026-11-17';
  const row: any = { key: 'b', name: 'Baby Spanac', unit: 'kg', productId: 'p', snapshots: { [t]: 693.5 }, received: {}, returned: {}, outbound: {}, commitments: {},
    orderedPerDate: { [t]: 280.8 }, transferAvg: Array(7).fill(956.5), actualConsumption: { [t]: 956.5 } };
  _expect(_delay([row], t, 1, t)[0].shortage).toBeCloseTo(263, 1);
});

_it('need is the historical average consumption, difference = stock at arrival + ordered − need', () => {
  const t = '2026-11-17';
  const truck = { loading: '2026-11-16', arrival: t, orderDay: '2026-11-14', deadline: '', phase: 'inchis' as const };
  const r: any = { key: 'b', name: 'Baby Spanac', unit: 'kg', productId: 'p', snapshots: { [t]: 693.5 }, received: {}, returned: {}, outbound: {}, commitments: {},
    orderedPerDate: { [t]: 280.8 }, transferAvg: Array(7).fill(956.5), actualConsumption: {}, buffer: 900 };
  const [l] = truckLines([r], [{ id: 'o', product_id: 'p', quantity: 280.8, delivery_date: t, order_date: '2026-11-14', status: 'ordered' }], truck, '2026-11-18', DEFAULT_RADAR_SETTINGS, t);
  _expect(l.need).toBeCloseTo(956.5, 1);
  _expect(l.delta).toBeCloseTo(17.8, 1);
  _expect(l.status).toBe('ok');
});
_it('need is not reduced by stock: 500 in stock, 100/day → need 100, difference +400', () => {
  const t = '2026-11-17';
  const truck = { loading: '2026-11-16', arrival: t, orderDay: '2026-11-14', deadline: '', phase: 'inchis' as const };
  const r: any = { key: 'x', name: 'Rucola', unit: 'kg', productId: 'p', snapshots: { [t]: 500 }, received: {}, returned: {}, outbound: {}, commitments: {},
    orderedPerDate: {}, transferAvg: Array(7).fill(100), actualConsumption: {}, buffer: 0 };
  const [l] = truckLines([r], [], truck, '2026-11-18', DEFAULT_RADAR_SETTINGS, t);
  _expect(l.need).toBeCloseTo(100);
  _expect(l.delta).toBeCloseTo(400);
});
