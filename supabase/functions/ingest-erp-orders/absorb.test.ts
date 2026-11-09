import { assertEquals } from "jsr:@std/assert";
import { isFirmReplacement, absorbedStatus, findAbsorbPairs } from "./absorb.ts";
Deno.test("same quantity later order is the firm order", () => assertEquals(isFirmReplacement(192, 192), true));
Deno.test("much smaller later order is a top-up", () => assertEquals(isFirmReplacement(100, 50), false));
Deno.test("174 of 192 produced stays in progress", () => assertEquals(absorbedStatus(174, 192, 'partial', 'L1'), 'partial'));
Deno.test("fully produced estimate completes firm order", () => assertEquals(absorbedStatus(192, 192, 'assigned', 'L1'), 'completed'));

const r = (id: string, n: string, q: number) => ({ id, numar_comanda: n, magazin: 'M', produs_id: 'P', data_productie: '2026-11-09', cantitate: q, status: 'assigned', linie_id: null });
Deno.test("later order absorbs earlier estimate", () => { const p = findAbsorbPairs([r('b','109026',192), r('a','108957',192)], new Set()); assertEquals(p.length, 1); assertEquals(p[0].old.id, 'a'); assertEquals(p[0].neu.id, 'b'); });
Deno.test("top-up of half stays separate", () => assertEquals(findAbsorbPairs([r('a','1',100), r('b','2',50)], new Set()).length, 0));
