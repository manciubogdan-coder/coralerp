import { jsonSchema, tool } from 'npm:ai@7.0.123';
import { TABLES, type Clients } from './appData.ts';
import { SENIOR_GUIDE } from './senior.ts';

export function businessSchemaTool(c: Clients) {
  return tool({
    description: 'Schema și reguli la cerere. Domeniu senior sau nume de tabel din aplicație.',
    inputSchema: jsonSchema<{ domeniu: string }>({ type: 'object', additionalProperties: false, required: ['domeniu'], properties: { domeniu: { type: 'string' } } }),
    execute: async ({ domeniu }) => {
      if (domeniu === 'senior') return { ghid: SENIOR_GUIDE };
      const table = TABLES[domeniu];
      if (!table) return { eroare: 'Tabel necunoscut' };
      try {
        const { data, error } = await c[table.db].from(domeniu).select('*').range(0, 0);
        if (error) return { ...table, eroare: `Schema nu poate fi verificată: ${error.message}` };
        return { ...table, coloane: Object.keys(data?.[0] ?? {}), avertisment: data?.length ? null : 'Tabel gol; coloanele nu pot fi deduse din rânduri.' };
      } catch (e) { return { ...table, eroare: `Schema nu poate fi verificată: ${(e as Error).message}` }; }
    },
  });
}