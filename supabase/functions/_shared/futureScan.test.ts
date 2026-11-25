import { assertEquals } from "jsr:@std/assert@1";
import { combineLevers, parseScan } from "./futureScan.ts";
Deno.test("two changes on the same lever compound", () => {
  assertEquals(combineLevers([{ lever: "salariu", pct: 10 }, { lever: "salariu", pct: 10 }]).salariu, 21);
});
Deno.test("items without a source link are dropped", () => {
  const r = parseScan('{"items":[{"lever":"motorina","pct":5,"url":""},{"lever":"motorina","pct":7,"url":"https://mfinante.gov.ro"}]}', "2026-11-25");
  assertEquals(r.items.length, 1); assertEquals(r.levers.motorina, 7);
});
