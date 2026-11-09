import { assertEquals } from "jsr:@std/assert";
import { isFirmReplacement, absorbedStatus } from "./absorb.ts";
Deno.test("same quantity later order is the firm order", () => assertEquals(isFirmReplacement(192, 192), true));
Deno.test("much smaller later order is a top-up", () => assertEquals(isFirmReplacement(100, 50), false));
Deno.test("174 of 192 produced stays in progress", () => assertEquals(absorbedStatus(174, 192, 'partial', 'L1'), 'partial'));
Deno.test("fully produced estimate completes firm order", () => assertEquals(absorbedStatus(192, 192, 'assigned', 'L1'), 'completed'));
