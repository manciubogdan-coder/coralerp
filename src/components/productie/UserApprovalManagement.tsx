import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, User, Clock, RefreshCw } from "lucide-react";

interface PendingUser {
  id: string;
  nume: string;
  rol: string;
  created_at: string;
  observatii_aprobare?: string;
}

const UserApprovalManagement = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPendingUsers = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    }
    try {
      console.log('🔍 Fetching pending users using RPC function...');
      
      // Folosim aceeași funcție RPC ca în UserManagement pentru consistență
      const { data: allUsers, error } = await supabase.rpc('get_all_users_for_admin');
      
      if (error) {
        console.error('❌ Error fetching all users:', error);
        throw error;
      }
      
      // Filtrăm doar utilizatorii neaprobați
      const pendingUsersData = allUsers?.filter(user => !user.aprobat) || [];
      
      console.log('✅ Found pending users:', pendingUsersData.length, pendingUsersData);
      setPendingUsers(pendingUsersData);
    } catch (error) {
      console.error('💥 Error fetching pending users:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca cererile de aprobare",
        variant: "destructive",
      });
      setPendingUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const handleRefresh = () => {
    fetchPendingUsers(true);
  };

  const handleApproveUser = async (userId: string, notes?: string) => {
    setActionLoading(userId);
    try {
      console.log('Approving user:', userId);
      const { error } = await supabase.rpc('approve_user', {
        user_id_to_approve: userId,
        approver_notes: notes || null
      });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Utilizatorul a fost aprobat cu succes",
      });

      // Refresh the list
      await fetchPendingUsers();
      setApprovalNotes("");
      setSelectedUserId(null);
    } catch (error) {
      console.error('Error approving user:', error);
      toast({
        title: "Eroare", 
        description: "Nu s-a putut aproba utilizatorul",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      console.log('Rejecting user:', userId);
      const { error } = await supabase.rpc('reject_user', {
        user_id_to_reject: userId
      });

      if (error) throw error;

      toast({
        title: "Succes",
        description: "Utilizatorul a fost respins și șters",
      });

      // Refresh the list
      await fetchPendingUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut respinge utilizatorul", 
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-coral-primary" />
          <p className="text-coral-600">Se încarcă cererile de aprobare...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-coral-primary">Aprobare Utilizatori</h2>
          <p className="text-coral-600">Gestionează cererile de acces la sistem</p>
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
            {pendingUsers.length} cereri în așteptare
          </Badge>
        </div>
      </div>

      {pendingUsers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Nu există cereri în așteptare</h3>
            <p className="text-gray-500">Toate cererile de acces au fost procesate.</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Verifică din nou
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingUsers.map((user) => (
            <Card key={user.id} className="border-l-4 border-l-amber-400">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{user.nume}</CardTitle>
                    <p className="text-sm text-gray-600">ID: {user.id.substring(0, 8)}...</p>
                  </div>
                  <Badge variant={user.rol === 'supervizor' ? 'default' : 'secondary'}>
                    {user.rol === 'supervizor' ? 'Supervizor' : 'Operator'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Cerere trimisă: {new Date(user.created_at).toLocaleDateString('ro-RO')}
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUserId(user.id)}
                          disabled={actionLoading === user.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Aprobare
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Aprobare Utilizator</DialogTitle>
                          <DialogDescription>
                            Ești pe cale să aprobi accesul pentru {user.nume} cu rolul de {user.rol}.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium">Observații (opțional)</label>
                            <Textarea
                              placeholder="Adaugă observații despre aprobare..."
                              value={approvalNotes}
                              onChange={(e) => setApprovalNotes(e.target.value)}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setApprovalNotes("");
                              setSelectedUserId(null);
                            }}
                          >
                            Anulează
                          </Button>
                          <Button
                            onClick={() => handleApproveUser(user.id, approvalNotes)}
                            disabled={actionLoading === user.id}
                          >
                            Aprobare Utilizator
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={actionLoading === user.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Respinge
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Respingere Utilizator</DialogTitle>
                          <DialogDescription>
                            Ești pe cale să respingi și să ștergi contul pentru {user.nume}. 
                            Această acțiune nu poate fi anulată.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline">
                            Anulează
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => handleRejectUser(user.id)}
                            disabled={actionLoading === user.id}
                          >
                            Respinge și Șterge
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserApprovalManagement;
