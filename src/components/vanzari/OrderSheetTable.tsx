import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { sheetTable, type OrderSheet, type OrderLine } from '@/lib/vanzari/orderSheets';

type Props = { sheet: OrderSheet; update: (id: string, patch: Partial<OrderLine>) => void; recipeControl: (line: OrderLine) => React.ReactNode };
export default function OrderSheetTable({ sheet, update, recipeControl }: Props) {
  const table = sheetTable(sheet);
  const setQuantity = (lines: OrderLine[], text: string) => {
    if (!lines.length) return;
    if (text === '') { lines.forEach(l => update(l.id, { taiat: 0 })); return; }
    let remaining = Math.max(0, Number(text) || 0);
    lines.forEach((l, i) => {
      const final = i === lines.length - 1 ? remaining : Math.min(l.bucati, remaining);
      remaining -= final;
      update(l.id, { taiat: l.bucati - final });
    });
  };
  return <div className="min-w-full w-max">
    <div className="sticky left-0 px-3 py-2 border-b space-y-1">
      <h2 className="font-semibold">COMANDA {sheet.title}</h2>
      <div className="text-xs text-muted-foreground">Nr. comandă: {[...new Set(sheet.lines.map(l => l.nr_comanda).filter(Boolean))].join(', ')}</div>
    </div>
    <table className="w-max min-w-full text-sm">
      <thead className="sticky top-0 bg-muted z-10"><tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:border [&>th]:text-left [&>th]:whitespace-nowrap">{table.headers.map((h, c) => <th key={c}>{h}</th>)}<th>Rețetă</th></tr></thead>
      <tbody>{table.rows.map(row => <tr key={row.key} className="[&>td]:px-2 [&>td]:py-1 [&>td]:border">
        {row.cells.map((cell, c) => {
          if (cell.rowSpan === 0) return null;
          const header = table.headers[c];
          const editable = cell.kind === 'modified' && !!cell.lines?.length;
          const packaging = header === 'Ambalaj primar' ? 'ambalaj_primar' : header === 'Ambalaj terțiar / cutie' ? 'ambalaj_tertiar' : header === 'Buc / Bax' ? 'buc_bax' : null;
          return <td key={c} rowSpan={cell.rowSpan} className={cn('whitespace-nowrap', editable && 'bg-primary/5', sheet.pivot && c >= 5 && c < 5 + sheet.warehouses.length * 3 && 'bg-muted/40')}>
            {editable ? <Input aria-label={`${header} ${row.line.produs}`} type="number" min="0" step="1" className="w-32 h-8 font-semibold" key={`${row.key}-${c}-${cell.value}`} defaultValue={cell.value} placeholder={String(cell.lines?.reduce((s, l) => s + l.bucati, 0) || 0)} onBlur={e => setQuantity(cell.lines || [], e.target.value)} />
              : packaging ? <Input aria-label={`${header} ${row.line.produs}`} className={cn('h-8', packaging === 'buc_bax' ? 'w-20' : 'w-60')} key={`${row.key}-${c}-${cell.value}`} defaultValue={cell.value} type={packaging === 'buc_bax' ? 'number' : 'text'} min={packaging === 'buc_bax' ? 1 : undefined} onBlur={e => sheet.lines.filter(l => l.produs === row.line.produs && l.gramaj === row.line.gramaj).forEach(l => update(l.id, { [packaging]: packaging === 'buc_bax' ? Number(e.target.value) || null : e.target.value }))} />
              : header === 'DENUMIRE PRODUS' || header === 'Gramaj (g)' ? <Input aria-label={`${header} ${row.line.produs}`} className={cn('h-8', header === 'DENUMIRE PRODUS' ? 'w-80' : 'w-24')} defaultValue={cell.value} type={header === 'Gramaj (g)' ? 'number' : 'text'} onBlur={e => sheet.lines.filter(l => l.produs === row.line.produs && l.gramaj === row.line.gramaj).forEach(l => update(l.id, header === 'Gramaj (g)' ? { gramaj: Number(e.target.value) || null } : { produs: e.target.value }))} />
              : cell.kind === 'original' && cell.lines?.length === 1 ? <Input aria-label={`Nr. Bucăți ${row.line.produs}`} className="w-28 h-8 text-right" type="number" min="0" defaultValue={cell.value} onBlur={e => { const l = cell.lines?.[0]; if (l) update(l.id, { bucati: Math.max(0, Number(e.target.value) || 0) }); }} />
              : <span className={cn('block', cell.kind === 'cases' && 'text-right font-medium', cell.kind === 'original' && 'text-right')}>{cell.value}</span>}
          </td>;
        })}
        <td>{recipeControl(row.line)}</td>
      </tr>)}</tbody>
      <tfoot><tr className="font-semibold"><td colSpan={table.headers.length + 1} className="px-3 py-3 border-t">TOTAL BAX: {table.totalCases.toLocaleString('ro-RO')} <span className="ml-6">TOTAL BUC: {table.totalUnits.toLocaleString('ro-RO')}</span>{table.pallets !== null && <span className="ml-6">Nr. Paleți: {table.pallets.toLocaleString('ro-RO', { maximumFractionDigits: 2 })}</span>}</td></tr></tfoot>
    </table>
    {sheet.notes.length > 0 && <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">{sheet.notes.map(note => <p key={note}>{note}</p>)}</div>}
  </div>;
}