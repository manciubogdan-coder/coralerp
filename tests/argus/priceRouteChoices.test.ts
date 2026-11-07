import { describe, expect, test } from 'bun:test';
import { buildRoutes, pointRoute, validRouteOverrides, configuredRawPalletKg } from '../../supabase/functions/_shared/priceSourceRules';
import { matchLoss } from '../../supabase/functions/_shared/priceSheet';

const sibiu = { pid: 2878, name: 'SIMPLIS TRADE', judet: 'SIBIU', country: 'ROMANIA' };

describe('user route choices for delivery points', () => {
  test('store choice beats county choice, county choice beats the address proposal', () => {
    expect(pointRoute(sibiu, { 'j:SIBIU': 'TURDA', 'p:2878': 'LUGOJ' })).toEqual({ route: 'LUGOJ', manual: true });
    expect(pointRoute(sibiu, { 'j:SIBIU': 'TURDA' })).toEqual({ route: 'TURDA', manual: true });
    expect(pointRoute(sibiu, {}).manual).toBe(false);
  });

  test('malformed choices are dropped before they reach Senior queries', () => {
    expect(validRouteOverrides({ 'p:12': 'TURDA', 'j:SIBIU': 'LUGOJ', "p:1;DROP": 'X', 'j:SIBIU2': "TURDA'--" })).toEqual({ 'p:12': 'TURDA', 'j:SIBIU': 'LUGOJ' });
    expect(validRouteOverrides([1, 2])).toEqual({});
  });

  test('a county assigned by the user moves its pallets into that cursă tariff', () => {
    const trips = [{ line: 'TRANSPORT DIST TURDA', trips: 10, total: 10000, qty: 10, pmin: 1000, pmax: 1000 }];
    const before = buildRoutes([{ ...sibiu, pallets: 50, missing: 0 }], trips);
    expect(before.unassigned.length).toBe(1);
    const after = buildRoutes([{ ...sibiu, pallets: 50, missing: 0 }], trips, { 'j:SIBIU': 'TURDA' });
    expect(after.unassigned.length).toBe(0);
    expect(after.routes[0].perPallet).toBe(200);
  });

  test('invoice lines without a Senior pallet coefficient are not converted into estimated pallets', () => {
    const trips = [{ line: 'TRANSPORT DIST TURDA', trips: 10, total: 10000, qty: 10, pmin: 1000, pmax: 1000 }];
    const r = buildRoutes([{ ...sibiu, pallets: 50, missing: 3, knownQty: 10000, missingQty: 5000 }], trips, { 'j:SIBIU': 'TURDA' });
    expect(r.routes[0].pallets).toBe(50);
    expect(r.routes[0].missingLines).toBe(3);
  });
});

describe('raw material names and pallet capacities', () => {
  test('cabbage is a head (400 kg/palet), red chard a leaf (220 kg/palet)', () => {
    expect(configuredRawPalletKg('VARZA VRAC')).toBe(400);
    expect(configuredRawPalletKg('RED CHARD VRAC')).toBe(220);
  });

  test('Coral loss names match Senior spellings with apostrophes and doubled letters', () => {
    const list = [{ name: 'Bulls Blod', pt_percent: 13.5 }, { name: 'Latuga Rossa', pt_percent: 15 }];
    expect(matchLoss("BULL'S BLOOD VRAC", list)?.pt).toBe(13.5);
    expect(matchLoss('LATUGA ROSA VRAC', list)?.pt).toBe(15);
  });
});
