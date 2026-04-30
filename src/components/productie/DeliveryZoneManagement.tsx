
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDeliveryZones, useCreateDeliveryZone, useUpdateDeliveryZone, useDeleteDeliveryZone } from '@/hooks/useProductionData';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, MapPin, ArrowUp, ArrowDown, Clock } from 'lucide-react';

const DeliveryZoneManagement = () => {
  const { data: zones = [], isLoading } = useDeliveryZones();
  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();
  const deleteZone = useDeleteDeliveryZone();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [formData, setFormData] = useState({
    nume_zona: '',
    descriere: '',
    prioritate: 1,
    culoare: '#10b981',
    ora_limita_plecare: '19:00'
  });

  const resetForm = () => {
    setFormData({
      nume_zona: '',
      descriere: '',
      prioritate: 1,
      culoare: '#10b981',
      ora_limita_plecare: '19:00'
    });
    setEditingZone(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingZone) {
        await updateZone.mutateAsync({
          id: editingZone.id,
          updates: formData
        });
        toast.success('Zona de livrare actualizată cu succes!');
      } else {
        await createZone.mutateAsync(formData);
        toast.success('Zona de livrare creată cu succes!');
      }
      
      resetForm();
      setShowCreateDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  const handleEdit = (zone: any) => {
    setEditingZone(zone);
    setFormData({
      nume_zona: zone.nume_zona,
      descriere: zone.descriere || '',
      prioritate: zone.prioritate,
      culoare: zone.culoare,
      ora_limita_plecare: zone.ora_limita_plecare || '19:00'
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur dorești să ștergi această zonă de livrare?')) return;
    
    try {
      await deleteZone.mutateAsync(id);
      toast.success('Zona de livrare ștearsă cu succes!');
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  const changePriority = async (zone: any, direction: 'up' | 'down') => {
    const newPriority = direction === 'up' ? zone.prioritate - 1 : zone.prioritate + 1;
    if (newPriority < 1) return;
    
    try {
      await updateZone.mutateAsync({
        id: zone.id,
        updates: { prioritate: newPriority }
      });
      toast.success('Prioritatea actualizată cu succes!');
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">Se încarcă zonele de livrare...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Management Zone de Livrare</h2>
          <p className="text-gray-600">Gestionează zonele de livrare și prioritățile acestora</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Zonă Nouă
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingZone ? 'Editează Zona' : 'Creează Zonă Nouă'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nume_zona">Nume Zonă</Label>
                <Input
                  id="nume_zona"
                  value={formData.nume_zona}
                  onChange={(e) => setFormData({ ...formData, nume_zona: e.target.value })}
                  placeholder="ex: București, Roman, etc."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="descriere">Descriere</Label>
                <Textarea
                  id="descriere"
                  value={formData.descriere}
                  onChange={(e) => setFormData({ ...formData, descriere: e.target.value })}
                  placeholder="Descrierea zonei de livrare"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prioritate">Prioritate (1 = cea mai înaltă)</Label>
                  <Input
                    id="prioritate"
                    type="number"
                    min="1"
                    value={formData.prioritate}
                    onChange={(e) => setFormData({ ...formData, prioritate: parseInt(e.target.value) })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="ora_limita_plecare">Ora Limită Plecare</Label>
                  <Input
                    id="ora_limita_plecare"
                    type="time"
                    value={formData.ora_limita_plecare}
                    onChange={(e) => setFormData({ ...formData, ora_limita_plecare: e.target.value })}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="culoare">Culoare</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    id="culoare"
                    type="color"
                    value={formData.culoare}
                    onChange={(e) => setFormData({ ...formData, culoare: e.target.value })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={formData.culoare}
                    onChange={(e) => setFormData({ ...formData, culoare: e.target.value })}
                    placeholder="#10b981"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Anulează
                </Button>
                <Button type="submit" disabled={createZone.isPending || updateZone.isPending}>
                  {editingZone ? 'Actualizează' : 'Creează'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: zone.culoare }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{zone.nume_zona}</h3>
                      <Badge variant="secondary">
                        Prioritate {zone.prioritate}
                      </Badge>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {zone.ora_limita_plecare || '19:00'}
                      </Badge>
                    </div>
                    {zone.descriere && (
                      <p className="text-gray-600 text-sm">{zone.descriere}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePriority(zone, 'up')}
                    disabled={zone.prioritate === 1}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changePriority(zone, 'down')}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(zone)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(zone.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default DeliveryZoneManagement;
