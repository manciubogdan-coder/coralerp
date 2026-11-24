// Argus' streamed voice arrives as raw 16-bit little-endian mono PCM in arbitrary byte chunks.
// Pure decoding rules, so the player stays thin and this can be tested without a browser.

/** Sample rate of the streamed Argus voice. */
export const VOICE_RATE = 24_000;
/** Audio gathered before a piece is scheduled (seconds): small enough to start at once, large enough to avoid clicks. */
export const VOICE_FIRST_SEC = 0.12;
export const VOICE_NEXT_SEC = 0.4;

/** Decodes whole samples from `bytes` (after an optional odd byte left from the previous chunk); returns the new leftover byte. */
export function decodePcm16(bytes: Uint8Array, carry: number | null): { samples: Float32Array; carry: number | null } {
  const total = bytes.length + (carry === null ? 0 : 1);
  const n = total >> 1;
  const samples = new Float32Array(n);
  const at = (i: number) => (carry === null ? bytes[i] : i === 0 ? carry : bytes[i - 1]);
  for (let s = 0; s < n; s++) {
    const v = at(2 * s) | (at(2 * s + 1) << 8);
    samples[s] = (v >= 0x8000 ? v - 0x10000 : v) / 0x8000;
  }
  return { samples, carry: total % 2 ? at(total - 1) : null };
}

/** When the next piece should play: right after the previous one, never in the past (small safety lead). */
export function nextStart(now: number, queuedUntil: number, lead = 0.05): number {
  return Math.max(queuedUntil, now + lead);
}
