// Server-only shared memory; never silently treat a failed read as an empty memory.
export async function loadMemory(c: { cloud: any }): Promise<string> {
  const facts: string[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await c.cloud.from("argus_memory")
      .select("id,fact,category,created_at")
      .order("created_at", { ascending: true }).order("id", { ascending: true })
      .range(from, from + 499);
    if (error) throw new Error(`Memoria permanentă Argus nu a putut fi citită: ${error.message}`);
    for (const r of data ?? []) facts.push(`- [${r.category}] ${r.fact}`);
    if (!data || data.length < 500) break;
  }
  return facts.length ? facts.join("\n") : "(încă goală)";
}