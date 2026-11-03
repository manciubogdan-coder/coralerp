/** Repair legacy empty SDK IDs without changing content, order or valid IDs.
 * Scoped positions are stable across retries; reserve existing IDs to avoid collisions.
 * Malformed containers/roles/parts remain the validator's responsibility.
 */
export function repairChatMessageIds<T extends { id: string }>(messages: T[], scope: string): T[] {
  if (!Array.isArray(messages)) return messages;
  const used = new Set(messages.map(m => m?.id).filter(id => typeof id === 'string' && id.length > 0));
  return messages.map((m, index) => {
    if (!m || typeof m !== 'object' || m.id !== '') return m;
    const base = `legacy:${scope}:${index}`;
    let id = base;
    for (let suffix = 1; used.has(id); suffix++) id = `${base}:${suffix}`;
    used.add(id);
    return { ...m, id };
  });
}

/** Validate message structure, not conversation age/length. Never discard saved turns. */
export function validChatMessages(messages: unknown): messages is Array<{
  id: string; role: 'user' | 'assistant'; parts: Array<Record<string, unknown>>;
}> {
  return Array.isArray(messages) && messages.length > 0 && messages.every(m =>
    m && typeof m.id === 'string' && m.id.length > 0 &&
    ['user', 'assistant'].includes(m.role) && Array.isArray(m.parts) &&
    m.parts.every((p: unknown) => p && typeof p === 'object' &&
      typeof (p as Record<string, unknown>).type === 'string')
  );
}

/** Cloud caps each page; keep reading so reopening a long chat cannot erase its tail. */
export async function readChatHistory<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}