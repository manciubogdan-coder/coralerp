import { describe, expect, test } from 'bun:test';
import { PALLET_RELATION, transportRoute, historicalFeePct, configuredRawPalletKg } from '../../supabase/functions/_shared/priceSourceRules';
import { prefilledConfig } from '../../supabase/functions/_shared/priceDefaults';
import { configuredSheet } from '../../supabase/functions/_shared/priceConfig';
describe('audited Senior calculator sources', () => {
  test('configured raw pallet capacities keep business values and do not guess unknown materials', () => {
    expect(configuredRawPalletKg('BABY SPANAC VRAC')).toBe(220);
    expect(configuredRawPalletKg('RADICHIO ROSSO VRAC')).toBe(500);
    expect(configuredRawPalletKg('ICEBERG')).toBe(400);
    expect(configuredRawPalletKg('necunoscut')).toBeUndefined();
  });
  test('Baby Spanac coefficient 448 remains valid when corresponding unit is PALET', () => {
    expect(PALLET_RELATION.includes('UM_ID_Corespondent')).toBe(false);
    const result = configuredSheet({product:{unitsPerCase:4},components:[]}, {labourPerPiece:0,utilitiesPerPiece:0,supplyPerKg:0,distributionPerPiece:0,clientFeePerPiece:0,eurRate:5,eurBufferPct:0,techLossPct:0,marginPct:0}, {piecesPerPallet:448,distributionPerPallet:448});
    expect(result.sheet.logistics).toBe(4);
  });
  test('Roman distribution is domestic, not Moldova', () => {
    expect(transportRoute('TRANSPORT DIST ROMAN')).toBe('România');
    expect(transportRoute('TRANSPORT DIST MOLDOVA ICS')).toBe('Moldova');
    expect(transportRoute('Transporturi diverse AVE')).toBeNull();
  });
  test('fiscal-group historical discount is a percentage of sales, not product purchase costs', () => {
    expect(historicalFeePct(1286999.49,4413200.19)).toBeCloseTo(29.16249,4);
    expect(historicalFeePct(0,0)).toBeNull();
  });
  test('route change loads its calculated tariff and preserves manual override', () => {
    const data = { product: { unitsPerCase:4 }, components:[], defaults:{route:'România',distributionPerPallet:300}, logistics:{distribution:{Bulgaria:{distributionPerPallet:1750,distributionPallets:29}}} };
    expect(prefilledConfig(data,{route:'Bulgaria'}).distributionPerPallet).toBe(1750);
    expect(prefilledConfig(data,{route:'Bulgaria',distributionPerPallet:100}).distributionPerPallet).toBe(100);
    expect(prefilledConfig({...data,defaults:{...data.defaults,rates:{labourPerPiece:.212}}},{route:'Bulgaria',rates:{}}).rates?.labourPerPiece).toBe(.212);
  });
  test('changing calculated total does not keep the old derived per-pallet tariff', () => {
    const data = {product:{unitsPerCase:4},components:[],defaults:{supplyPerPallet:300,supplyTotal:3000,supplyPallets:10}};
    const cfg = prefilledConfig(data,{supplyTotal:2000});
    expect(cfg.supplyPerPallet).toBe(200);
  });
});import { deliveryRoute, buildRoutes, routeKey } from '../../supabase/functions/_shared/priceSourceRules';
import { validPriceConfig } from '../../supabase/functions/_shared/priceConfig';
describe('distribution per Senior cursă', () => {
  test('stores propose their cursă from the store suffix, then the county', () => {
    expect(deliveryRoute({ name: 'MEGA IMAGE SRL - BOLINTIN DEAL', judet: 'Giurgiu', country: 'România' })).toBe('BUCURESTI');
    expect(deliveryRoute({ name: 'MEGA IMAGE SRL - ROMAN', judet: 'Neamt' })).toBe('ROMAN');
    expect(deliveryRoute({ name: 'LIDL DISCOUNT SRL - LUGOJ', judet: 'Timis' })).toBe('LUGOJ');
    expect(deliveryRoute({ name: 'LIDL DISCOUNT SRL - IERNUT', judet: 'Mures' })).toBe('TURDA-IERNUT');
    expect(deliveryRoute({ name: 'SELGROS CASH & CARRY SRL - BUCURESTI 1410059', judet: 'Brasov' })).toBe('BUCURESTI');
    expect(deliveryRoute({ name: 'AUCHAN ROMÂNIA SA - AUCHAN WAREHOUSE CAMPUS 5299', judet: 'Ilfov' })).toBe('BUCURESTI');
    expect(deliveryRoute({ name: 'VALENCIA TRADING OFFICE', judet: 'MUSATCHEVO', country: 'Bulgaria' })).toBe('BULGARIA');
    expect(deliveryRoute({ name: 'HONEST FOOD SRL', judet: 'Bihor' })).toBeNull();
  });
  test('cursă tariff = carrier trips of the cursă ÷ pallets delivered to its stores', () => {
    expect(routeKey('TRANSPORT DIST BUCURESTI')).toBe('BUCURESTI');
    const { routes, unassigned } = buildRoutes(
      [{ pid: 2954, name: 'MEGA IMAGE SRL - BOLINTIN DEAL', judet: 'Giurgiu', pallets: 60, missing: 0 }, { pid: 1234, name: 'MEGA IMAGE SRL  - STEFANESTI', judet: 'Ilfov', pallets: 40, missing: 0 }, { pid: 9, name: 'HONEST FOOD SRL', judet: 'Bihor', pallets: 5, missing: 0 }],
      [{ line: 'TRANSPORT DIST BUCURESTI', trips: 10, qty: 10, total: 30000, pmin: 700, pmax: 5800 }, { line: 'TRANSPORT DIST HORECA', trips: 1, qty: 4729, total: 22320.88, pmin: 4.72, pmax: 4.72 }],
    );
    const b = routes.find((r) => r.route === 'BUCURESTI')!;
    expect(b.perPallet).toBe(300);
    expect(b.perTrip).toBe(3000);
    expect(b.palletsPerTrip).toBe(10);
    expect(routes.find((r) => r.route === 'HORECA')!.unitPrice).toBeCloseTo(4.72, 2);
    expect(unassigned.map((p) => p.name)).toEqual(['HONEST FOOD SRL']);
  });
  test('typed pallets per trip divide the average trip cost', () => {
    const data = { product: { unitsPerCase: 4 }, components: [], defaults: { route: 'BUCURESTI', distributionTotal: 30000, distributionTrips: 10, distributionPallets: 100, distributionPerPallet: 300 } };
    expect(prefilledConfig(data, { route: 'BUCURESTI', distributionPalletsPerTrip: 6 }).distributionPerPallet).toBe(500);
    expect(validPriceConfig({ route: 'TURDA-IERNUT' })).toEqual({ route: 'TURDA-IERNUT' });
    expect(validPriceConfig({ route: "x'; DROP" })).toBeNull();
  });
});

import { orderedPallets } from "../../supabase/functions/_shared/priceSourceRules";
describe("orderedPallets", () => {
  test("divides ordered kg by range pallet norms and skips products without a norm", () => {
    const r = orderedPallets([
      { name: "Baby Spanac", unit: "kg", qty: 440 },
      { name: "Iceberg", unit: "kg", qty: 800 },
      { name: "Radicchio", unit: "kg", qty: 1000 },
      { name: "Morcov", unit: "kg", qty: 500 },
    ]);
    expect(r.pallets).toBe(6);
    expect(r.skipped.map((x) => x.name)).toEqual(["Morcov"]);
  });
});
