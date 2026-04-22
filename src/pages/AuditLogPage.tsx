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

const getOperationType = (log: AuditLog) => {
  const tableName = log.table_name;
  const data = log.new_data ?? log.old_data ?? {};
  const historyAction = normalizeText(data.action);

  if (tableName.includes('stock_transfer')) return 'Bon de transfer';
  if (tableName.includes('reception_records')) return 'Recepție';
  if (tableName.includes('inventory_history')) {
    if (historyAction.includes('transfer')) return 'Bon de transfer';
    if (historyAction.includes('consum')) return 'Consum';
    if (historyAction.includes('recept')) return 'Recepție';
    return 'Mișcare stoc';
  }
  if (tableName.includes('production_stock')) return 'Stoc producție';
  if (tableName.includes('daily_stock')) return 'Snapshot dimineață';
  if (tableName.includes('products')) return 'Articol';
  if (tableName.includes('suppliers')) return 'Furnizor';
  if (tableName.includes('manufacturers')) return 'Producător';
  if (tableName.includes('inventory')) return log.action === 'INSERT' ? 'Recepție / adăugare stoc' : 'Modificare stoc';
  return tableLabels[tableName] ?? tableName;
};

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
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('id, occurred_at, user_email, user_name, action, table_name, record_label, changed_fields, old_data, new_data')
        .order('occurred_at', { ascending: false })
        .limit(300);

      if (error) {
        toast({ title: 'Eroare', description: 'Nu s-a putut încărca jurnalul de audit', variant: 'destructive' });
      } else {
        setLogs(((data as unknown as AuditLog[]) ?? []));
      }
      setIsLoading(false);
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
          <CardTitle>Ultimele operații</CardTitle>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Caută user, produs, tabel..." className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
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
                    <TableHead>Zonă</TableHead>
                    <TableHead>Articol</TableHead>
                    <TableHead>Modificări</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">{new Date(log.occurred_at).toLocaleString('ro-RO')}</TableCell>
                      <TableCell>
                        <div className="font-medium">{log.user_name || 'Utilizator necunoscut'}</div>
                        <div className="text-xs text-muted-foreground">{log.user_email || 'fără email'}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{actionLabel[log.action] || log.action}</Badge></TableCell>
                      <TableCell>{log.table_name}</TableCell>
                      <TableCell>{log.record_label || '-'}</TableCell>
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
                  ))}
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