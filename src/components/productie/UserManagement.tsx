
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Edit, Trash2, Key, Users, UserCheck, UserX, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/productie/AuthContext";

interface User {
  id: string;
  nume: string;
  rol: string;
  aprobat: boolean;
  created_at: string;
  data_aprobare?: string;
  aprobat_de?: string;
  observatii_aprobare?: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>("");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ nume: "", rol: "", aprobat: false });
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { user, userRole, session } = useAuth();

  const fetchUsers = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      console.log('🔍 Fetching all users from productie_profiles...');
      console.log('🔑 Current user:', user?.email, 'Role:', userRole);
      
      // Pentru admin sau supervizor, folosim funcția RPC
      if (user?.email === 'manciubogdan999@gmail.com' || userRole === 'supervizor') {
        console.log('📋 Using admin/supervizor RPC function to fetch all users...');
        
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_users_for_admin');
        
        if (rpcError) {
          console.error('❌ RPC failed:', rpcError);
          throw rpcError;
        } else {
          console.log('✅ RPC succeeded, found users:', rpcData?.length || 0);
          if (Array.isArray(rpcData)) {
            setUsers(rpcData);
          } else {
            console.warn('⚠️ RPC returned non-array data:', rpcData);
            setUsers([]);
          }
        }
      } else {
        console.log('⚠️ User is not admin or supervizor, limited access');
        setUsers([]);
      }
    } catch (error) {
      console.error('💥 Error fetching users:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca utilizatorii",
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user, userRole]);

  const handleRefresh = () => {
    fetchUsers(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUserId || !newPassword || newPassword.length < 6) {
      toast({
        title: "Eroare",
        description: "Introduceți o parolă de cel puțin 6 caractere",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(selectedUserId);
    try {
      console.log('🔑 Attempting to reset password for user:', selectedUserId);
      
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { 
          userId: selectedUserId, 
          newPassword: newPassword 
        },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error('❌ Password reset error:', error);
        throw error;
      }

      console.log('✅ Password reset successful');
      toast({
        title: "Succes",
        description: `Parola pentru ${selectedUserName} a fost schimbată cu succes`,
      });

      // Reset form and close dialog
      setNewPassword("");
      setSelectedUserId(null);
      setSelectedUserName("");
      setShowPasswordDialog(false);
    } catch (error) {
      console.error('💥 Error resetting password:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut schimba parola. Verificați conexiunea și încercați din nou.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Ești sigur că vrei să ștergi utilizatorul ${userName}? Această acțiune nu poate fi anulată.`)) {
      return;
    }

    setActionLoading(userId);
    try {
      console.log('🗑️ Attempting to delete user:', userId);
      
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (error) {
        console.error('❌ Delete user error:', error);
        throw error;
      }

      console.log('✅ User deleted successfully');
      toast({
        title: "Succes",
        description: `Utilizatorul ${userName} a fost șters cu succes`,
      });

      await fetchUsers();
    } catch (error) {
      console.error('💥 Error deleting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut șterge utilizatorul",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser || !editForm.nume.trim()) {
      toast({
        title: "Eroare",
        description: "Numele utilizatorului este obligatoriu",
        variant: "destructive",
      });
      return;
    }

    if (!session?.access_token) {
      toast({
        title: "Eroare",
        description: "Nu sunteți autentificat. Vă rugăm să vă reconectați.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(editingUser.id);
    try {
      console.log('🔄 Updating user using edge function:', editingUser.id, editForm);
      console.log('🔐 Using access token:', session.access_token ? 'Present' : 'Missing');
      
      const updates = {
        nume: editForm.nume,
        rol: editForm.rol,
        aprobat: editForm.aprobat,
        // Setăm și datele de aprobare dacă utilizatorul a fost aprobat
        ...(editForm.aprobat && !editingUser.aprobat ? {
          data_aprobare: new Date().toISOString(),
          aprobat_de: user?.id,
          observatii_aprobare: `Aprobat prin editare de către ${user?.email}`
        } : {})
      };

      const response = await fetch(`https://mfcdlifjxxdrekzdatfb.supabase.co/functions/v1/update-user-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mY2RsaWZqeHhkcmVremRhdGZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQyMTg0MTMsImV4cCI6MjA1OTc5NDQxM30.P7molAFqPEpn4hwwEvKzYTEFHRlJhhvQ8GM29CqEDxk'
        },
        body: JSON.stringify({ 
          userId: editingUser.id,
          updates: updates
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('❌ Error response from edge function:', data);
        throw new Error(data.error || 'Request failed');
      }

      console.log('✅ User updated successfully via edge function:', data);
      toast({
        title: "Succes",
        description: `Utilizatorul ${editForm.nume} a fost actualizat cu succes`,
      });

      // Reset form and close dialog
      setEditingUser(null);
      setShowEditDialog(false);
      setEditForm({ nume: "", rol: "", aprobat: false });
      await fetchUsers();
    } catch (error) {
      console.error('💥 Error updating user:', error);
      toast({
        title: "Eroare",
        description: `Nu s-a putut actualiza utilizatorul: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      nume: user.nume,
      rol: user.rol,
      aprobat: user.aprobat
    });
    setShowEditDialog(true);
  };

  const startPasswordReset = (userId: string, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setNewPassword("");
    setShowPasswordDialog(true);
  };

  const getStatusBadge = (user: User) => {
    if (user.aprobat) {
      return <Badge className="bg-green-500"><UserCheck className="h-3 w-3 mr-1" />Aprobat</Badge>;
    } else {
      return <Badge variant="destructive"><UserX className="h-3 w-3 mr-1" />Neaprobat</Badge>;
    }
  };

  const getRoleBadge = (rol: string) => {
    if (rol === 'supervizor') {
      return <Badge variant="default">Supervizor</Badge>;
    } else if (rol === 'picking') {
      return <Badge className="bg-blue-500">Picking</Badge>;
    } else {
      return <Badge variant="secondary">Operator</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Users className="h-8 w-8 animate-spin mx-auto mb-4 text-coral-primary" />
          <p className="text-coral-600">Se încarcă utilizatorii...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-coral-primary">Management Utilizatori</h2>
          <p className="text-coral-600">Gestionează toate conturile din sistem</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Reîmprospătează
          </Button>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {users.length} utilizatori totali
          </Badge>
        </div>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Nu există utilizatori</h3>
            <p className="text-gray-500">Nu s-au găsit utilizatori în baza de date.</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-400">
                User actual: {user?.email} | Rol: {userRole}
              </p>
              <Button onClick={handleRefresh} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Încearcă din nou
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Toți Utilizatorii
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nume</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Creare</TableHead>
                  <TableHead>Data Aprobare</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nume}</TableCell>
                    <TableCell>{getRoleBadge(user.rol)}</TableCell>
                    <TableCell>{getStatusBadge(user)}</TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString('ro-RO')}
                    </TableCell>
                    <TableCell>
                      {user.data_aprobare 
                        ? new Date(user.data_aprobare).toLocaleDateString('ro-RO')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {/* Edit User */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(user)}
                          disabled={actionLoading === user.id}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Reset Password */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startPasswordReset(user.id, user.nume)}
                          disabled={actionLoading === user.id}
                        >
                          <Key className="h-4 w-4" />
                        </Button>

                        {/* Delete User */}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id, user.nume)}
                          disabled={actionLoading === user.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează Utilizator</DialogTitle>
            <DialogDescription>
              Modifică informațiile pentru {editingUser?.nume}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="nume">Nume</Label>
              <Input
                id="nume"
                value={editForm.nume}
                onChange={(e) => setEditForm({...editForm, nume: e.target.value})}
                placeholder="Introduceți numele"
              />
            </div>
            <div>
              <Label htmlFor="rol">Rol</Label>
              <Select
                value={editForm.rol}
                onValueChange={(value) => setEditForm({...editForm, rol: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectați rolul" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="picking">Picking</SelectItem>
                  <SelectItem value="supervizor">Supervizor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="aprobat"
                checked={editForm.aprobat}
                onChange={(e) => setEditForm({...editForm, aprobat: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="aprobat">Cont Aprobat</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Anulează
            </Button>
            <Button 
              onClick={handleEditUser}
              disabled={actionLoading === editingUser?.id}
            >
              {actionLoading === editingUser?.id ? "Se salvează..." : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schimbă Parola</DialogTitle>
            <DialogDescription>
              Setează o nouă parolă pentru {selectedUserName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Noua Parolă</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Introduceți noua parolă (min. 6 caractere)"
                minLength={6}
              />
              <p className="text-sm text-gray-500 mt-1">
                Parola trebuie să aibă cel puțin 6 caractere
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowPasswordDialog(false)}
            >
              Anulează
            </Button>
            <Button 
              onClick={handleResetPassword}
              disabled={actionLoading === selectedUserId || newPassword.length < 6}
            >
              {actionLoading === selectedUserId ? "Se schimbă..." : "Schimbă Parola"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
