import { Input } from '@/components/ui/input';
import { type OrderSheet, type OrderLine } from '@/lib/vanzari/orderSheets';
import { orderDocument, type DocumentCell } from '@/lib/vanzari/orderDocument';
import '@/lib/vanzari/orderReference.css';

type Props = { sheet: OrderSheet; delivery: string; update: (id: string, patch: Partial<OrderLine>) => void; recipeControl: (line: OrderLine) => React.ReactNode };
export default function OrderSheetTable({ sheet, delivery, update, recipeControl }: Props) {
  const document = orderDocument(sheet, delivery);
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
  const edit = (cell: DocumentCell, text: string) => {
    const lines = cell.lines || [], field = cell.field;
    if (field === 'final') { setQuantity(lines, text); return; }
    if (!field) return;
    if (field === 'bucati' && lines.length > 1) {
      let remaining = Math.max(0, Number(text) || 0);
      lines.forEach((l, i) => { const n = i === lines.length - 1 ? remaining : Math.min(l.bucati, remaining); remaining -= n; update(l.id, { bucati: n }); });
      return;
    }
    lines.forEach(l => update(l.id, { [field]: field === 'produs' || field === 'ambalaj_primar' || field === 'ambalaj_tertiar' ? text : Math.max(0, Number(text) || 0) }));
  };
  return <div className="w-max min-w-full">
    <table className="order-template" aria-label={`Comanda ${sheet.title}`} style={{ width: document.widths.reduce((s, w) => s + w, 0) }}>
      <colgroup>{document.widths.map((width, c) => <col key={c} style={{ width }} />)}</colgroup>
      <tbody>{document.rows.map((row, r) => <tr key={r} style={{ height: `${document.heights[r]}pt` }}>
        {row.map((cell, c) => cell.hidden ? null : <td key={c} rowSpan={cell.rowSpan} colSpan={cell.colSpan} className={`order-style-${cell.style}`}>
          {cell.field && cell.lines?.length ? <Input key={`${r}-${c}-${cell.value}`} aria-label={`${cell.field} ${cell.lines[0]?.produs}`} type={['produs', 'ambalaj_primar', 'ambalaj_tertiar'].includes(cell.field) ? 'text' : 'number'} min="0" step="1" defaultValue={cell.value} onBlur={e => edit(cell, e.target.value)} /> : cell.value}
        </td>)}
      </tr>)}</tbody>
    </table>
    <div className="print:hidden border-t p-3 space-y-2">
      {document.products.filter(p => p.lines.length).map(({ p, lines }) => <div key={p.row} className="flex items-center gap-3 text-sm"><span className="w-64 truncate">{p.product} {p.weight}g</span>{recipeControl(lines[0])}</div>)}
    </div>
  </div>;
}