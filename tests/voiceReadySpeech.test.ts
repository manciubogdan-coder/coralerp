import { describe, it, expect } from "vitest";
import { readySpeech } from "@/lib/argus/voiceRules";
describe("readySpeech", () => {
  it("speaks the first finished sentence before the answer ends", () => {
    const r = readySpeech("Coral a plătit 12.000 lei pe curent luna trecută. Dacă energia", 0, false);
    expect(r.chunk).toBe("Coral a plătit 12.000 lei pe curent luna trecută.");
  });
  it("waits while no sentence is finished", () => {
    expect(readySpeech("Coral a plătit 12.000 lei pe", 0, false).chunk).toBe("");
  });
  it("final speaks the rest after what was spoken", () => {
    const t = "Prima frază este destul de lungă aici. A doua";
    const a = readySpeech(t, 0, false);
    expect(readySpeech(t, a.next, true).chunk).toBe("A doua");
  });
});
