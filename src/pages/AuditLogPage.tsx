import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileClock, Loader2, Search } from 'lucide-react';
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
}

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

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('id, occurred_at, user_email, user_name, action, table_name, record_label, changed_fields')
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
    if (!query) return logs;
    return logs.filter((log) =>
      [log.user_email, log.user_name, log.table_name, log.record_label, actionLabel[log.action], log.action]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [logs, search]);

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