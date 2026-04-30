
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateDeliveryZone, useUpdateDeliveryZone } from '@/hooks/useProductionData';
import { toast } from 'sonner';

interface DeliveryZoneFormProps {
  zone?: any;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DeliveryZoneForm = ({ zone, onSuccess, onCancel }: DeliveryZoneFormProps) => {
  const [formData, setFormData] = useState({
    nume_zona: zone?.nume_zona || '',
    descriere: zone?.descriere || '',
    prioritate: zone?.prioritate || 1,
    culoare: zone?.culoare || '#10b981',
    ora_limita_plecare: zone?.ora_limita_plecare || '19:00'
  });

  const createZone = useCreateDeliveryZone();
  const updateZone = useUpdateDeliveryZone();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nume_zona.trim()) {
      toast.error('Numele zonei este obligatoriu');
      return;
    }

    try {
      if (zone) {
        await updateZone.mutateAsync({
          id: zone.id,
          updates: formData
        });
        toast.success('Zona a fost actualizată cu succes!');
      } else {
        await createZone.mutateAsync(formData);
        toast.success('Zona a fost creată cu succes!');
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {zone ? 'Editează Zona de Livrare' : 'Adaugă Zonă de Livrare'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nume_zona">Nume Zonă *</Label>
            <Input
              id="nume_zona"
              value={formData.nume_zona}
              onChange={(e) => setFormData({...formData, nume_zona: e.target.value})}
              placeholder="ex: București, Roman, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descriere">Descriere</Label>
            <Input
              id="descriere"
              value={formData.descriere}
              onChange={(e) => setFormData({...formData, descriere: e.target.value})}
              placeholder="Descriere opțională"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prioritate">Prioritate (1 = cea mai înaltă)</Label>
              <Input
                id="prioritate"
                type="number"
                min="1"
                max="10"
                value={formData.prioritate}
                onChange={(e) => setFormData({...formData, prioritate: parseInt(e.target.value) || 1})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ora_limita_plecare">Ora Limită Plecare</Label>
              <Input
                id="ora_limita_plecare"
                type="time"
                value={formData.ora_limita_plecare}
                onChange={(e) => setFormData({...formData, ora_limita_plecare: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="culoare">Culoare</Label>
            <div className="flex items-center gap-2">
              <Input
                id="culoare"
                type="color"
                value={formData.culoare}
                onChange={(e) => setFormData({...formData, culoare: e.target.value})}
                className="w-16 h-10"
              />
              <Input
                value={formData.culoare}
                onChange={(e) => setFormData({...formData, culoare: e.target.value})}
                placeholder="#10b981"
                className="flex-1"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={createZone.isPending || updateZone.isPending}>
              {zone ? 'Actualizează' : 'Creează'} Zona
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Anulează
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default DeliveryZoneForm;
