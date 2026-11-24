import { describe, it, expect } from "vitest";
import { decodePcm16, nextStart } from "@/lib/viziune/pcmStream";

describe("Argus streamed voice decoding", () => {
  it("decodes little-endian 16-bit samples", () => {
    const { samples, carry } = decodePcm16(new Uint8Array([0x00, 0x40, 0x00, 0xc0, 0xff, 0x7f]), null);
    expect(Array.from(samples)).toEqual([0.5, -0.5, 32767 / 32768]);
    expect(carry).toBeNull();
  });
  it("keeps a sample split across two network chunks", () => {
    const a = decodePcm16(new Uint8Array([0x00, 0x40, 0x00]), null);
    expect(a.samples.length).toBe(1);
    expect(a.carry).toBe(0x00);
    const b = decodePcm16(new Uint8Array([0xc0]), a.carry);
    expect(Array.from(b.samples)).toEqual([-0.5]);
    expect(b.carry).toBeNull();
  });
  it("plays pieces back to back and never in the past", () => {
    expect(nextStart(10, 12.4)).toBe(12.4);
    expect(nextStart(10, 3)).toBeCloseTo(10.05);
  });
});
