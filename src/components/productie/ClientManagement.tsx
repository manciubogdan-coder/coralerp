import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, useDeliveryZones } from '@/hooks/useProductionData';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus, MapPin } from 'lucide-react';
import ClientSearch from './ClientSearch';

const ClientManagement = () => {
  const { data: clients = [], isLoading } = useClients();
  const { data: zones = [] } = useDeliveryZones();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [formData, setFormData] = useState({
    nume_magazin: '',
    punct_livrare: '',
    adresa: '',
    telefon: '',
    email: '',
    zona_livrare_id: ''
  });

  const [searchFilters, setSearchFilters] = useState({
    numeMagazin: '',
    zonaLivrare: ''
  });

  // Filtrarea clienților
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesMagazin = !searchFilters.numeMagazin || 
        client.nume_magazin.toLowerCase().includes(searchFilters.numeMagazin.toLowerCase());
      
      const matchesZona = !searchFilters.zonaLivrare || 
        client.zona_livrare_id === searchFilters.zonaLivrare;

      return matchesMagazin && matchesZona;
    });
  }, [clients, searchFilters]);

  const resetForm = () => {
    setFormData({
      nume_magazin: '',
      punct_livrare: '',
      adresa: '',
      telefon: '',
      email: '',
      zona_livrare_id: ''
    });
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const clientData = {
        ...formData,
        zona_livrare_id: formData.zona_livrare_id || null
      };

      if (editingClient) {
        await updateClient.mutateAsync({
          id: editingClient.id,
          updates: clientData
        });
        toast.success('Client actualizat cu succes!');
      } else {
        await createClient.mutateAsync(clientData);
        toast.success('Client creat cu succes!');
      }
      
      resetForm();
      setShowCreateDialog(false);
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setFormData({
      nume_magazin: client.nume_magazin,
      punct_livrare: client.punct_livrare,
      adresa: client.adresa || '',
      telefon: client.telefon || '',
      email: client.email || '',
      zona_livrare_id: client.zona_livrare_id || ''
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur dorești să ștergi acest client?')) return;
    
    try {
      await deleteClient.mutateAsync(id);
      toast.success('Client șters cu succes!');
    } catch (error: any) {
      toast.error(error.message || 'A apărut o eroare');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">Se încarcă clienții...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Management Clienți</h2>
          <p className="text-gray-600">Gestionează magazinele și punctele de livrare</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Client Nou
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? 'Editează Client' : 'Creează Client Nou'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nume_magazin">Nume Magazin</Label>
                <Input
                  id="nume_magazin"
                  value={formData.nume_magazin}
                  onChange={(e) => setFormData({ ...formData, nume_magazin: e.target.value })}
                  placeholder="ex: Carrefour, Auchan, etc."
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="punct_livrare">Punct de Livrare</Label>
                <Input
                  id="punct_livrare"
                  value={formData.punct_livrare}
                  onChange={(e) => setFormData({ ...formData, punct_livrare: e.target.value })}
                  placeholder="ex: București Sud, Roman Centru"
                  required
                />
              </div>

              <div>
                <Label htmlFor="zona_livrare">Zona de Livrare</Label>
                <Select 
                  value={formData.zona_livrare_id} 
                  onValueChange={(value) => setFormData({ ...formData, zona_livrare_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează zona de livrare" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Fără zonă</SelectItem>
                    {zones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: zone.culoare }}
                          />
                          {zone.nume_zona} (Prioritate {zone.prioritate})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="adresa">Adresă</Label>
                <Input
                  id="adresa"
                  value={formData.adresa}
                  onChange={(e) => setFormData({ ...formData, adresa: e.target.value })}
                  placeholder="Adresa completă"
                />
              </div>
              
              <div>
                <Label htmlFor="telefon">Telefon</Label>
                <Input
                  id="telefon"
                  value={formData.telefon}
                  onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                  placeholder="0721234567"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@email.com"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Anulează
                </Button>
                <Button type="submit" disabled={createClient.isPending || updateClient.isPending}>
                  {editingClient ? 'Actualizează' : 'Creează'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ClientSearch 
        searchFilters={searchFilters}
        setSearchFilters={setSearchFilters}
        zones={zones}
      />

      <div className="grid gap-4">
        {filteredClients.map((client) => (
          <Card key={client.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{client.nume_magazin}</h3>
                    {client.productie_zone_livrare && (
                      <Badge 
                        variant="secondary"
                        className="flex items-center gap-1"
                        style={{ backgroundColor: `${client.productie_zone_livrare.culoare}20`, borderColor: client.productie_zone_livrare.culoare }}
                      >
                        <MapPin className="h-3 w-3" />
                        {client.productie_zone_livrare.nume_zona}
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600">{client.punct_livrare}</p>
                  {client.adresa && <p className="text-sm text-gray-500">{client.adresa}</p>}
                  <div className="flex gap-4 text-sm text-gray-500">
                    {client.telefon && <span>📞 {client.telefon}</span>}
                    {client.email && <span>✉️ {client.email}</span>}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(client)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(client.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredClients.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Nu există clienți care să corespundă filtrelor</h3>
              <p className="text-gray-600">Încercați să modificați criteriile de căutare.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ClientManagement;
