import { expect, test } from "bun:test";
import { isDone } from "../src/lib/argus/backgroundWatch";
const p = { threadId: "t", sentAt: Date.parse("2026-11-10T10:00:00Z"), question: "q" };
test("answer done only when thread saved after question", () => {
  expect(isDone(p, "2026-11-10T09:59:00Z", p.sentAt + 1000)).toBe(false);
  expect(isDone(p, "2026-11-10T10:01:00Z", p.sentAt + 1000)).toBe(true);
});
test("gives up after 30 minutes", () => {
  expect(isDone(p, undefined, p.sentAt + 31 * 60_000)).toBe(true);
});
