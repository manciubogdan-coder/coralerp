import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Shield, Loader2, Users, ArrowLeft, Trash2, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DEPARTMENTS, type AppRole, type DepartmentRole } from '@/lib/departments';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  approved: boolean;
  created_at: string;
  isAdmin?: boolean;
  departments?: DepartmentRole[];
}

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Roles editor dialog state
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [draftAdmin, setDraftAdmin] = useState(false);
  const [draftDepts, setDraftDepts] = useState<Set<DepartmentRole>>(new Set());
  const [savingRoles, setSavingRoles] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('app_profiles' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: allRoles, error: rolesError } = await supabase
        .from('app_user_roles' as any)
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesByUser = new Map<string, string[]>();
      ((allRoles as unknown as Array<{ user_id: string; role: string }>) || []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) || [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });

      const usersWithRoles = ((profiles as any[]) || []).map((profile) => {
        const roles = rolesByUser.get(profile.user_id) || [];
        const departments = roles.filter((r): r is DepartmentRole =>
          DEPARTMENTS.some((d) => d.id === r),
        );
        return {
          ...profile,
          isAdmin: roles.includes('admin'),
          departments,
        } as UserProfile;
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Eroare',
        description: 'Nu s-au putut încărca utilizatorii',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleApprove = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      const { error } = await supabase
        .from('app_profiles' as any)
        .update({ approved: true })
        .eq('id', userProfile.id);
      if (error) throw error;
      toast({ title: 'Utilizator aprobat', description: `${userProfile.email} a fost aprobat cu succes` });
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut aproba utilizatorul', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      const { error } = await supabase
        .from('app_profiles' as any)
        .update({ approved: false })
        .eq('id', userProfile.id);
      if (error) throw error;
      toast({ title: 'Acces revocat', description: `Accesul pentru ${userProfile.email} a fost revocat` });
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut revoca accesul', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      const { error } = await supabase
        .from('app_profiles' as any)
        .delete()
        .eq('id', userProfile.id);
      if (error) throw error;
      toast({ title: 'Utilizator șters', description: `${userProfile.email} a fost șters` });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ title: 'Eroare', description: 'Nu s-a putut șterge utilizatorul', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const openRolesEditor = (u: UserProfile) => {
    setEditing(u);
    setDraftAdmin(!!u.isAdmin);
    setDraftDepts(new Set(u.departments || []));
  };

  const toggleDept = (dept: DepartmentRole) => {
    setDraftDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const saveRoles = async () => {
    if (!editing) return;
    setSavingRoles(true);
    try {
      const current = new Set<AppRole>([
        ...(editing.isAdmin ? (['admin'] as AppRole[]) : []),
        ...(editing.departments || []),
      ]);
      const desired = new Set<AppRole>([
        ...(draftAdmin ? (['admin'] as AppRole[]) : []),
        ...Array.from(draftDepts),
      ]);

      const toAdd: AppRole[] = Array.from(desired).filter((r) => !current.has(r));
      const toRemove: AppRole[] = Array.from(current).filter((r) => !desired.has(r));

      if (toAdd.length) {
        const { error } = await supabase
          .from('app_user_roles' as any)
          .insert(toAdd.map((role) => ({ user_id: editing.user_id, role })));
        if (error) throw error;
      }

      for (const role of toRemove) {
        const { error } = await supabase
          .from('app_user_roles' as any)
          .delete()
          .eq('user_id', editing.user_id)
          .eq('role', role);
        if (error) throw error;
      }

      toast({ title: 'Roluri actualizate', description: `Rolurile pentru ${editing.email} au fost salvate.` });
      setEditing(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving roles:', error);
      toast({
        title: 'Eroare la salvare',
        description: error?.message || 'Nu s-au putut salva rolurile.',
        variant: 'destructive',
      });
    } finally {
      setSavingRoles(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Nu aveți permisiuni pentru această pagină</p>
      </div>
    );
  }

  const pendingUsers = users.filter((u) => !u.approved);
  const approvedUsers = users.filter((u) => u.approved);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/administrativ')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Managementul Utilizatorilor
          </h1>
          <p className="text-muted-foreground">Aprobă și gestionează accesul utilizatorilor</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {pendingUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                    {pendingUsers.length}
                  </Badge>
                  Utilizatori în așteptare
                </CardTitle>
                <CardDescription>Acești utilizatori așteaptă aprobarea pentru a accesa aplicația</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nume</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Data înregistrării</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">{userProfile.name || '-'}</TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>{new Date(userProfile.created_at).toLocaleDateString('ro-RO')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApprove(userProfile)}
                            disabled={actionLoading === userProfile.id}
                          >
                            {actionLoading === userProfile.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Aprobă
                              </>
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" disabled={actionLoading === userProfile.id}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Șterge
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Șterge utilizatorul?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Această acțiune va șterge permanent contul pentru {userProfile.email}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Anulează</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(userProfile)}>
                                  Șterge
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {approvedUsers.length}
                </Badge>
                Utilizatori activi
              </CardTitle>
              <CardDescription>Utilizatorii care au acces la aplicație</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nu există utilizatori activi</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nume</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Departamente</TableHead>
                      <TableHead>Data înregistrării</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">{userProfile.name || '-'}</TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {userProfile.isAdmin && (
                              <Badge className="bg-primary/10 text-primary">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                            {(userProfile.departments || []).map((d) => {
                              const def = DEPARTMENTS.find((x) => x.id === d);
                              return (
                                <Badge key={d} variant="secondary">
                                  {def?.short || d}
                                </Badge>
                              );
                            })}
                            {!userProfile.isAdmin && (userProfile.departments || []).length === 0 && (
                              <span className="text-xs text-muted-foreground">Niciunul</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{new Date(userProfile.created_at).toLocaleDateString('ro-RO')}</TableCell>
                        <TableCell className="text-right space-x-2">
                          {userProfile.user_id !== user?.id ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openRolesEditor(userProfile)}
                                disabled={actionLoading === userProfile.id}
                              >
                                <Settings2 className="h-4 w-4 mr-1" />
                                Editează roluri
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(userProfile)}
                                disabled={actionLoading === userProfile.id}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Revocă Acces
                              </Button>
                            </>
                          ) : (
                            <Badge variant="outline">Tu</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editează roluri</DialogTitle>
            <DialogDescription>
              {editing?.email} — selectează departamentele la care are acces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="flex items-center gap-3 p-3 rounded-md border bg-primary/5">
              <Checkbox
                checked={draftAdmin}
                onCheckedChange={(v) => setDraftAdmin(v === true)}
              />
              <div>
                <div className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Administrator
                </div>
                <div className="text-xs text-muted-foreground">Acces complet la toate departamentele.</div>
              </div>
            </label>

            <div className="space-y-1">
              {DEPARTMENTS.map((dept) => {
                const Icon = dept.icon;
                const checked = draftDepts.has(dept.id);
                return (
                  <label
                    key={dept.id}
                    className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleDept(dept.id)} />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{dept.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingRoles}>
              Anulează
            </Button>
            <Button onClick={saveRoles} disabled={savingRoles}>
              {savingRoles && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagementPage;
