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