import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Pencil, Plus } from 'lucide-react';
import { useClients, useOrders } from '@/hooks/productie/useProductionData';
import { auditHorecaClients, type ClientAuditRow } from '@/lib/productie/horecaClientAudit';
import { todayISO } from './DateProductiePicker';

export default function HorecaClientVerification({ onEdit }: { onEdit: (row: ClientAuditRow) => void }) {
  const clients = useClients();
  const [day, setDay] = useState(todayISO);
  const orders = useOrders(day);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const rows = useMemo(() => auditHorecaClients(clients.data || [], orders.data || [], day), [clients.data, orders.data, day]);
  const options = [
    { id: 'all', label: 'Toți clienții', count: rows.length },
    { id: 'Caterin', label: 'Caterin', count: rows.filter(r => r.group === 'Caterin').length },
    { id: 'Mircea', label: 'Mircea', count: rows.filter(r => r.group === 'Mircea').length },
    { id: 'none', label: 'Fără grupă HoReCa', count: rows.filter(r => !r.group && r.client).length },
    { id: 'issues', label: 'De verificat', count: rows.filter(r => r.issue).length },
    { id: 'today', label: 'Cu comenzi în ziua aleasă', count: rows.filter(r => r.orders > 0).length },
  ];
  const visible = rows.filter(r => (filter === 'all' || filter === r.group || filter === 'none' && !r.group && r.client || filter === 'issues' && r.issue || filter === 'today' && r.orders > 0) &&
    `${r.name} ${r.point} ${r.nickname}`.toLocaleLowerCase('ro').includes(search.toLocaleLowerCase('ro')));
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <h3 className="text-lg font-semibold">Verificare clienți HoReCa</h3>
      <Input type="date" aria-label="Ziua verificării" className="w-44" value={day} onChange={e => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) setDay(e.target.value); }} />
      <Button variant="outline" size="sm" disabled={clients.isFetching || orders.isFetching} onClick={() => { void clients.refetch(); void orders.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Reverifică</Button>
    </div>
    <div className="flex flex-wrap gap-2">{options.map(o => <Button key={o.id} size="sm" variant={filter === o.id ? 'default' : 'outline'} onClick={() => setFilter(o.id)}>{o.label} · {o.count}</Button>)}</div>
    <Input aria-label="Caută client HoReCa" placeholder="Client, punct de livrare sau poreclă" value={search} onChange={e => setSearch(e.target.value)} />
    {clients.isError || orders.isError ? <p role="alert" className="text-destructive">Verificarea este incompletă: nu s-au putut citi clienții sau comenzile. Reîncearcă.</p> : clients.isLoading || orders.isFetching ? <p role="status" className="text-muted-foreground">Se verifică registrul și comenzile…</p> : <>
      <div className="max-h-[55vh] overflow-auto rounded-md border">
        <Table><TableHeader className="sticky top-0 z-10 bg-background"><TableRow><TableHead>Client / punct livrare</TableHead><TableHead>Poreclă</TableHead><TableHead>Grupă HoReCa</TableHead><TableHead>Comenzi în ziua aleasă</TableHead><TableHead>Verificare</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>{visible.map(row => <TableRow key={row.id}>
            <TableCell><div className="font-medium">{row.name}</div><div className="text-xs text-muted-foreground">{row.point}</div></TableCell>
            <TableCell>{row.nickname || '—'}</TableCell><TableCell><Badge variant={row.group ? 'default' : 'outline'}>{row.group || 'În afara HoReCa'}</Badge></TableCell>
            <TableCell>{row.orders}</TableCell><TableCell>{row.issue ? <span className="text-destructive">{row.issue === 'missing' ? 'Client lipsă din registru' : 'Atribuire ambiguă'}</span> : row.group ? 'Inclus în HoReCa' : 'Fără Caterin / Mircea'}</TableCell>
            <TableCell><Button variant="outline" size="sm" aria-label={`${row.client ? 'Atribuie' : 'Adaugă'} ${row.name} ${row.point}`} onClick={() => onEdit(row)}>{row.client ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{row.client ? 'Atribuie' : 'Adaugă client'}</Button></TableCell>
          </TableRow>)}{!visible.length && <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Niciun client pentru filtrele alese.</TableCell></TableRow>}</TableBody>
        </Table>
      </div>
      <p className="text-sm text-muted-foreground">{visible.length} din {rows.length} înregistrări · Registrul include și clienții fără comenzi în ziua aleasă; clienții Senior încă neimportați nu sunt verificați.</p>
    </>}
  </section>;
}