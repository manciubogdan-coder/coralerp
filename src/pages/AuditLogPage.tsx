import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileClock, Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface AuditLog {
  id: string;
  occurred_at: string;
  user_email: string | null;
  user_name: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  table_name: string;
  record_label: string | null;
  changed_fields: Record<string, { old: unknown; new: unknown }> | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

const tableLabels: Record<string, string> = {
  inventory: 'Stoc materii prime',
  reception_records: 'Recepție materii prime',
  inventory_history: 'Istoric materii prime',
  stock_transfers: 'Bon de transfer materii prime',
  stock_transfer_items: 'Articole bon transfer materii prime',
  production_stock: 'Stoc producție materii prime',
  products: 'Produse materii prime',
  suppliers: 'Furnizori materii prime',
  manufacturers: 'Producători materii prime',
  ambalaje_inventory: 'Stoc ambalaje',
  ambalaje_reception_records: 'Recepție ambalaje',
  ambalaje_inventory_history: 'Istoric ambalaje',
  ambalaje_stock_transfers: 'Bon de transfer ambalaje',
  ambalaje_stock_transfer_items: 'Articole bon transfer ambalaje',
  ambalaje_production_stock: 'Stoc producție ambalaje',
  ambalaje_products: 'Produse ambalaje',
  ambalaje_suppliers: 'Furnizori ambalaje',
  ambalaje_manufacturers: 'Producători ambalaje',
  etichete_inventory: 'Stoc etichete',
  etichete_reception_records: 'Recepție etichete',
  etichete_inventory_history: 'Istoric etichete',
  etichete_stock_transfers: 'Bon de transfer etichete',
  etichete_stock_transfer_items: 'Articole bon transfer etichete',
  etichete_production_stock: 'Stoc producție etichete',
  etichete_products: 'Produse etichete',
  etichete_suppliers: 'Furnizori etichete',
  etichete_manufacturers: 'Producători etichete',
};

const actionLabel: Record<string, string> = {
  INSERT: 'Creat',
  UPDATE: 'Modificat',
  DELETE: 'Șters',
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return 'gol';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const normalizeText = (value: unknown) => String(value ?? '').toLowerCase();

const getInventoryType = (tableName: string) => {
  if (tableName.startsWith('etichete_')) return 'Etichete';
  if (tableName.startsWith('ambalaje_')) return 'Ambalaje';
  return 'Materii prime';
};

type OperationInfo = { label: string; color: string };

const OP_COLORS = {
  reception: 'bg-green-100 text-green-800 border-green-300',
  transferOut: 'bg-orange-100 text-orange-800 border-orange-300',
  transferIn: 'bg-blue-100 text-blue-800 border-blue-300',
  consumption: 'bg-red-100 text-red-800 border-red-300',
  manualAdd: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  manualRemove: 'bg-rose-100 text-rose-800 border-rose-300',
  manualSet: 'bg-amber-100 text-amber-800 border-amber-300',
  movement: 'bg-slate-100 text-slate-800 border-slate-300',
  production: 'bg-purple-100 text-purple-800 border-purple-300',
  snapshot: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  meta: 'bg-gray-100 text-gray-700 border-gray-300',
};

const getOperationInfo = (log: AuditLog): OperationInfo => {
  const tableName = log.table_name;
  const data = log.new_data ?? log.old_data ?? {};
  const historyAction = normalizeText(data.action);
  const notes = normalizeText(data.notes);

  if (tableName.includes('stock_transfer_items')) {
    return { label: 'Bon transfer → Producție (articol)', color: OP_COLORS.transferOut };
  }
  if (tableName.includes('stock_transfers')) {
    return { label: 'Bon transfer → Producție', color: OP_COLORS.transferOut };
  }
  if (tableName.includes('reception_records')) {
    return { label: 'Recepție de la furnizor', color: OP_COLORS.reception };
  }
  if (tableName.includes('inventory_history')) {
    if (historyAction === 'transfer_out' || historyAction.includes('transfer_out') || (historyAction.includes('transfer') && notes.includes('catre productie'))) {
      return { label: 'Bon transfer → Producție', color: OP_COLORS.transferOut };
    }
    if (historyAction === 'transfer_in' || historyAction === 'return' || historyAction.includes('return') || historyAction.includes('transfer_in')) {
      return { label: 'Întors din Producție', color: OP_COLORS.transferIn };
    }
    if (historyAction.includes('transfer')) return { label: 'Transfer stoc', color: OP_COLORS.movement };
    if (historyAction.includes('consum')) return { label: 'Consum producție', color: OP_COLORS.consumption };
    if (historyAction.includes('recept')) return { label: 'Recepție de la furnizor', color: OP_COLORS.reception };
    if (historyAction === 'add') return { label: 'Adăugare manuală stoc', color: OP_COLORS.manualAdd };
    if (historyAction === 'remove') return { label: 'Scădere manuală stoc', color: OP_COLORS.manualRemove };
    if (historyAction === 'set') return { label: 'Setare cantitate', color: OP_COLORS.manualSet };
    return { label: `Mișcare stoc (${historyAction || '?'})`, color: OP_COLORS.movement };
  }
  if (tableName.includes('production_stock')) {
    if (log.action === 'INSERT') return { label: 'Intrare stoc producție', color: OP_COLORS.production };
    if (log.action === 'DELETE') return { label: 'Ștergere stoc producție', color: OP_COLORS.production };
    return { label: 'Modificare stoc producție', color: OP_COLORS.production };
  }
  if (tableName.includes('daily_stock')) return { label: 'Snapshot dimineață', color: OP_COLORS.snapshot };
  if (tableName.includes('products')) return { label: 'Nomenclator articole', color: OP_COLORS.meta };
  if (tableName.includes('suppliers')) return { label: 'Nomenclator furnizori', color: OP_COLORS.meta };
  if (tableName.includes('manufacturers')) return { label: 'Nomenclator producători', color: OP_COLORS.meta };
  if (tableName.includes('inventory')) {
    if (log.action === 'INSERT') return { label: 'Recepție / adăugare stoc', color: OP_COLORS.reception };
    if (log.action === 'DELETE') return { label: 'Ștergere din stoc', color: OP_COLORS.manualRemove };
    return { label: 'Modificare stoc', color: OP_COLORS.movement };
  }
  return { label: tableLabels[tableName] ?? tableName, color: OP_COLORS.meta };
};

const getOperationType = (log: AuditLog) => getOperationInfo(log).label;

const getNumericValue = (value: unknown) => {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getQuantityChange = (log: AuditLog) => {
  const quantityFields = ['quantity', 'net_quantity', 'original_quantity', 'quantity_ordered', 'consider_quantity'];

  for (const field of quantityFields) {
    const change = log.changed_fields?.[field];
    const oldValue = getNumericValue(change?.old);
    const newValue = getNumericValue(change?.new);
    if (oldValue !== null && newValue !== null && oldValue !== newValue) {
      return { field, oldValue, newValue, delta: newValue - oldValue };
    }
  }

  const sourceData = log.action === 'DELETE' ? log.old_data : log.new_data;
  for (const field of quantityFields) {
    const value = getNumericValue(sourceData?.[field]);
    if (value !== null) {
      return { field, oldValue: log.action === 'INSERT' ? 0 : value, newValue: log.action === 'DELETE' ? 0 : value, delta: log.action === 'DELETE' ? -value : value };
    }
  }

  return null;
};

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const pageSize = 1000;
        let offset = 0;
        let all: AuditLog[] = [];
        // Hard cap to avoid runaway loads
        const maxRows = 50000;
        while (offset < maxRows) {
          const { data, error } = await supabase
            .from('audit_logs' as any)
            .select('id, occurred_at, user_email, user_name, action, table_name, record_label, changed_fields, old_data, new_data')
            .order('occurred_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
          if (error) throw error;
          const batch = (data as unknown as AuditLog[]) ?? [];
          all = all.concat(batch);
          if (batch.length < pageSize) break;
          offset += pageSize;
        }
        setLogs(all);
      } catch (e) {
        toast({ title: 'Eroare', description: 'Nu s-a putut încărca jurnalul de audit', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    if (isAdmin) fetchLogs();
  }, [isAdmin, toast]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const logDate = log.occurred_at.slice(0, 10);
      const userText = normalizeText(`${log.user_name ?? ''} ${log.user_email ?? ''}`);
      const zoneText = normalizeText(`${log.table_name} ${tableLabels[log.table_name] ?? ''}`);
      const itemText = normalizeText(log.record_label);
      const operationText = normalizeText(`${getOperationType(log)} ${actionLabel[log.action] ?? log.action}`);
      const inventoryTypeText = normalizeText(getInventoryType(log.table_name));
      const allText = normalizeText([
        log.user_email,
        log.user_name,
        log.table_name,
        tableLabels[log.table_name],
        log.record_label,
        actionLabel[log.action],
        log.action,
        getOperationType(log),
        getInventoryType(log.table_name),
      ].filter(Boolean).join(' '));

      return (!query || allText.includes(query))
        && (!dateFilter || logDate === dateFilter)
        && (!userFilter || userText.includes(normalizeText(userFilter)))
        && (!zoneFilter || zoneText.includes(normalizeText(zoneFilter)))
        && (!itemFilter || itemText.includes(normalizeText(itemFilter)))
        && (!operationFilter || operationText.includes(normalizeText(operationFilter)))
        && (!inventoryTypeFilter || inventoryTypeText.includes(normalizeText(inventoryTypeFilter)));
    });
  }, [dateFilter, inventoryTypeFilter, itemFilter, logs, operationFilter, search, userFilter, zoneFilter]);

  const resetFilters = () => {
    setSearch('');
    setDateFilter('');
    setUserFilter('');
    setZoneFilter('');
    setItemFilter('');
    setOperationFilter('');
    setInventoryTypeFilter('');
  };

  if (!isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Nu aveți permisiuni pentru această pagină</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileClock className="h-6 w-6" />
            Audit Operații
          </h1>
          <p className="text-muted-foreground">Vezi cine a modificat datele, când și ce câmpuri au fost schimbate.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ultimele operații ({filteredLogs.length})</CardTitle>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută user, produs, tabel..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} aria-label="Filtru dată" />
            <Input value={userFilter} onChange={(event) => setUserFilter(event.target.value)} placeholder="Filtru user" />
            <Input value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} placeholder="Filtru zonă" />
            <Input value={itemFilter} onChange={(event) => setItemFilter(event.target.value)} placeholder="Filtru articol" />
            <Input value={operationFilter} onChange={(event) => setOperationFilter(event.target.value)} placeholder="Filtru operație" />
            <Input value={inventoryTypeFilter} onChange={(event) => setInventoryTypeFilter(event.target.value)} placeholder="Filtru: materii prime / ambalaje / etichete" className="lg:col-span-2" />
            <Button type="button" variant="outline" onClick={resetFilters} className="gap-2">
              <X className="h-4 w-4" />
              Resetează filtre
            </Button>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data și ora</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Operație</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Zonă</TableHead>
                    <TableHead>Articol</TableHead>
                    <TableHead>Cantitate operată</TableHead>
                    <TableHead>Modificări</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const quantityChange = getQuantityChange(log);
                    const opInfo = getOperationInfo(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">{new Date(log.occurred_at).toLocaleString('ro-RO')}</TableCell>
                        <TableCell>
                          <div className="font-medium">{log.user_name || 'Utilizator necunoscut'}</div>
                          <div className="text-xs text-muted-foreground">{log.user_email || 'fără email'}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{actionLabel[log.action] || log.action}</Badge></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${opInfo.color} font-medium`}>{opInfo.label}</Badge>
                          <div className="text-xs text-muted-foreground mt-1">{getInventoryType(log.table_name)}</div>
                        </TableCell>
                        <TableCell>{tableLabels[log.table_name] || log.table_name}</TableCell>
                        <TableCell>{log.record_label || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {quantityChange ? (
                            <div>
                              <div className="font-medium">{quantityChange.delta > 0 ? '+' : ''}{quantityChange.delta.toLocaleString('ro-RO')}</div>
                              <div className="text-xs text-muted-foreground">{quantityChange.oldValue.toLocaleString('ro-RO')} → {quantityChange.newValue.toLocaleString('ro-RO')}</div>
                            </div>
                          ) : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="min-w-80 max-w-xl">
                          {log.action === 'UPDATE' && log.changed_fields ? (
                            <div className="space-y-1 text-sm">
                              {Object.entries(log.changed_fields).slice(0, 8).map(([field, change]) => (
                                <div key={field} className="break-words">
                                  <span className="font-medium">{field}</span>: {formatValue(change.old)} → {formatValue(change.new)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">{log.action === 'INSERT' ? 'Înregistrare creată' : 'Înregistrare ștearsă'}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogPage;