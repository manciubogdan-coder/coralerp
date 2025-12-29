import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Shield, Loader2, Users, ArrowLeft, Trash2 } from 'lucide-react';
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

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  approved: boolean;
  created_at: string;
  isAdmin?: boolean;
}

const UserManagementPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('app_profiles' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('app_user_roles' as any)
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = new Set((adminRoles as any[])?.map(r => r.user_id) || []);

      const usersWithRoles = (profiles as any[])?.map(profile => ({
        ...profile,
        isAdmin: adminUserIds.has(profile.user_id),
      })) || [];

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

      toast({
        title: 'Utilizator aprobat',
        description: `${userProfile.email} a fost aprobat cu succes`,
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut aproba utilizatorul',
        variant: 'destructive',
      });
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

      toast({
        title: 'Acces revocat',
        description: `Accesul pentru ${userProfile.email} a fost revocat`,
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut revoca accesul',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      if (userProfile.isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('app_user_roles' as any)
          .delete()
          .eq('user_id', userProfile.user_id)
          .eq('role', 'admin');

        if (error) throw error;

        toast({
          title: 'Rol actualizat',
          description: `${userProfile.email} nu mai este administrator`,
        });
      } else {
        // Add admin role
        const { error } = await supabase
          .from('app_user_roles' as any)
          .insert({ user_id: userProfile.user_id, role: 'admin' });

        if (error) throw error;

        toast({
          title: 'Rol actualizat',
          description: `${userProfile.email} este acum administrator`,
        });
      }
      
      fetchUsers();
    } catch (error) {
      console.error('Error toggling admin:', error);
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut actualiza rolul',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userProfile: UserProfile) => {
    setActionLoading(userProfile.id);
    try {
      // Delete profile (cascade will delete roles)
      const { error } = await supabase
        .from('app_profiles' as any)
        .delete()
        .eq('id', userProfile.id);

      if (error) throw error;

      toast({
        title: 'Utilizator șters',
        description: `${userProfile.email} a fost șters`,
      });
      
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Eroare',
        description: 'Nu s-a putut șterge utilizatorul',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Nu aveți permisiuni pentru această pagină</p>
      </div>
    );
  }

  const pendingUsers = users.filter(u => !u.approved);
  const approvedUsers = users.filter(u => u.approved);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Managementul Utilizatorilor
          </h1>
          <p className="text-muted-foreground">
            Aprobă și gestionează accesul utilizatorilor
          </p>
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
                <CardDescription>
                  Acești utilizatori așteaptă aprobarea pentru a accesa aplicația
                </CardDescription>
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
                        <TableCell className="font-medium">
                          {userProfile.name || '-'}
                        </TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>
                          {new Date(userProfile.created_at).toLocaleDateString('ro-RO')}
                        </TableCell>
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
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading === userProfile.id}
                              >
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
              <CardDescription>
                Utilizatorii care au acces la aplicație
              </CardDescription>
            </CardHeader>
            <CardContent>
              {approvedUsers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nu există utilizatori activi
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nume</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Data înregistrării</TableHead>
                      <TableHead className="text-right">Acțiuni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedUsers.map((userProfile) => (
                      <TableRow key={userProfile.id}>
                        <TableCell className="font-medium">
                          {userProfile.name || '-'}
                        </TableCell>
                        <TableCell>{userProfile.email}</TableCell>
                        <TableCell>
                          {userProfile.isAdmin ? (
                            <Badge className="bg-primary/10 text-primary">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Utilizator</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(userProfile.created_at).toLocaleDateString('ro-RO')}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {userProfile.user_id !== user?.id && (
                            <>
                              <Button
                                size="sm"
                                variant={userProfile.isAdmin ? "secondary" : "outline"}
                                onClick={() => handleToggleAdmin(userProfile)}
                                disabled={actionLoading === userProfile.id}
                              >
                                {actionLoading === userProfile.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-1" />
                                    {userProfile.isAdmin ? 'Revocă Admin' : 'Fă Admin'}
                                  </>
                                )}
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
                          )}
                          {userProfile.user_id === user?.id && (
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
    </div>
  );
};

export default UserManagementPage;
