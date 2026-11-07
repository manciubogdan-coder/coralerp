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
    expect(cfg.supplyPerPallet).toBeUndefined();
    expect((cfg.supplyTotal ?? 0)/(cfg.supplyPallets ?? 1)).toBe(200);
  });
});