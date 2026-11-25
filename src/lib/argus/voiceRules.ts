/** Preserve the full spoken answer, but keep every request below the existing voice service's 900-character limit. */
export function speechChunks(text: string, maxLength = 880): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > 900) throw new Error("Lungime vocală invalidă.");
  const plain = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, "").replace(/[*_#`>|]/g, " ").replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  let rest = plain;
  while (rest.length > maxLength) {
    let end = rest.lastIndexOf(" ", maxLength);
    if (end < 1) end = maxLength;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
/**
 * Text of a streaming answer that can already be spoken: everything after `spoken` up to the
 * last finished sentence (or all of it when `final`). The first piece may be short so speech starts fast.
 */
export function readySpeech(text: string, spoken: number, final: boolean, minLength = 30): { chunk: string; next: number } {
  const rest = text.slice(spoken);
  if (final) return { chunk: rest.trim(), next: text.length };
  let end = -1;
  const re = /[.!?;:](?=\s)|\n/g;
  for (let m = re.exec(rest); m; m = re.exec(rest)) end = m.index + 1;
  if (end < minLength) return { chunk: "", next: spoken };
  return { chunk: rest.slice(0, end).trim(), next: spoken + end };
}
