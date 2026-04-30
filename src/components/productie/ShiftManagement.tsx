
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useShifts, getCurrentShift, calculateShiftDuration } from "@/hooks/productie/useShifts";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const ShiftManagement = () => {
  const { data: shifts, isLoading } = useShifts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [newShift, setNewShift] = useState({
    nume: '',
    ora_start: '',
    ora_sfarsit: ''
  });

  const createShiftMutation = useMutation({
    mutationFn: async (shiftData: { nume: string; ora_start: string; ora_sfarsit: string }) => {
      console.log('Creating shift with data:', shiftData);
      
      const { data, error } = await supabase
        .from('productie_schimburi')
        .insert([{
          nume: shiftData.nume.trim(),
          ora_start: shiftData.ora_start,
          ora_sfarsit: shiftData.ora_sfarsit
        }])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating shift:', error);
        throw error;
      }
      console.log('Shift created successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setIsAdding(false);
      setNewShift({ nume: '', ora_start: '', ora_sfarsit: '' });
      toast({
        title: "Schimb adăugat",
        description: "Schimbul a fost adăugat cu succes"
      });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut adăuga schimbul",
        variant: "destructive"
      });
    }
  });

  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase
        .from('productie_schimburi')
        .delete()
        .eq('id', shiftId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({
        title: "Schimb șters",
        description: "Schimbul a fost șters cu succes"
      });
    }
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase
        .from('productie_schimburi')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      setEditingShift(null);
      toast({
        title: "Schimb actualizat",
        description: "Schimbul a fost actualizat cu succes"
      });
    }
  });

  const handleCreateShift = () => {
    // Validări îmbunătățite
    if (!newShift.nume.trim()) {
      toast({
        title: "Eroare",
        description: "Numele schimbului este obligatoriu",
        variant: "destructive"
      });
      return;
    }

    if (!newShift.ora_start || !newShift.ora_sfarsit) {
      toast({
        title: "Eroare",
        description: "Ora de start și ora de sfârșit sunt obligatorii",
        variant: "destructive"
      });
      return;
    }

    // Verificăm că orele sunt diferite
    if (newShift.ora_start === newShift.ora_sfarsit) {
      toast({
        title: "Eroare",
        description: "Ora de start trebuie să fie diferită de ora de sfârșit",
        variant: "destructive"
      });
      return;
    }

    console.log('Attempting to create shift:', newShift);
    createShiftMutation.mutate(newShift);
  };

  const handleDeleteShift = (shiftId: string) => {
    if (window.confirm('Sunteți sigur că doriți să ștergeți acest schimb?')) {
      deleteShiftMutation.mutate(shiftId);
    }
  };

  const currentShift = shifts ? getCurrentShift(shifts) : null;
  const totalWorkingHours = shifts?.reduce((total, shift) => 
    total + calculateShiftDuration(shift.ora_start, shift.ora_sfarsit), 0
  ) || 0;

  if (isLoading) {
    return <div>Se încarcă schimburile...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Managementul Schimburilor</h2>
        <p className="text-muted-foreground">Configurează și gestionează schimburile de lucru</p>
      </div>

      {/* Informații generale */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schimb Curent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentShift ? (
              <div>
                <div className="text-lg font-bold text-green-600">{currentShift.nume}</div>
                <div className="text-sm text-muted-foreground">
                  {currentShift.ora_start} - {currentShift.ora_sfarsit}
                </div>
                <div className="text-xs text-muted-foreground">
                  {calculateShiftDuration(currentShift.ora_start, currentShift.ora_sfarsit)}h durată
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Niciun schimb activ acum
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Schimburi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{shifts?.length || 0}</div>
            <div className="text-xs text-muted-foreground">schimburi configurate</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ore Totale/Zi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalWorkingHours}h</div>
            <div className="text-xs text-muted-foreground">timp total de lucru</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista schimburilor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Schimburi Configurate</CardTitle>
          <Button
            onClick={() => setIsAdding(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Adaugă Schimb
          </Button>
        </CardHeader>
        <CardContent>
          {isAdding && (
            <div className="mb-4 p-4 border rounded-lg bg-gray-50">
              <h4 className="font-medium mb-3">Schimb Nou</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="nume">Nume Schimb</Label>
                  <Input
                    id="nume"
                    value={newShift.nume}
                    onChange={(e) => setNewShift({ ...newShift, nume: e.target.value })}
                    placeholder="ex: Schimbul 1"
                  />
                </div>
                <div>
                  <Label htmlFor="ora_start">Ora Start</Label>
                  <Input
                    id="ora_start"
                    type="time"
                    value={newShift.ora_start}
                    onChange={(e) => setNewShift({ ...newShift, ora_start: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ora_sfarsit">Ora Sfârșit</Label>
                  <Input
                    id="ora_sfarsit"
                    type="time"
                    value={newShift.ora_sfarsit}
                    onChange={(e) => setNewShift({ ...newShift, ora_sfarsit: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button 
                  onClick={handleCreateShift}
                  disabled={createShiftMutation.isPending}
                  size="sm"
                >
                  {createShiftMutation.isPending ? 'Se salvează...' : 'Salvează'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsAdding(false);
                    setNewShift({ nume: '', ora_start: '', ora_sfarsit: '' });
                  }}
                  size="sm"
                >
                  Anulează
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {shifts?.map((shift) => {
              const duration = calculateShiftDuration(shift.ora_start, shift.ora_sfarsit);
              const isCurrentShift = currentShift?.id === shift.id;
              
              return (
                <div key={shift.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {shift.nume}
                        {isCurrentShift && (
                          <Badge variant="default" className="text-xs">
                            ACTIV
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {shift.ora_start} - {shift.ora_sfarsit} ({duration}h)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingShift(shift.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteShift(shift.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {shifts?.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Nu există schimburi configurate. Adăugați primul schimb pentru a începe.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShiftManagement;
