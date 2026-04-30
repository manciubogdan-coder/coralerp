
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useProducts, useClients, useUpdateOrder, useProductionLines } from "@/hooks/useProductionData";

interface OrderEditDialogProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

const OrderEditDialog = ({ order, onClose, onSuccess }: OrderEditDialogProps) => {
  const [magazin, setMagazin] = useState(order.magazin || "");
  const [produsId, setProdusId] = useState(order.produs_id || "");
  const [cantitate, setCantitate] = useState(order.cantitate || 0);
  const [linieId, setLinieId] = useState(order.linie_id || "");
  const [status, setStatus] = useState(order.status || "pending");

  const { data: products } = useProducts();
  const { data: clients } = useClients();
  const { data: lines } = useProductionLines();
  const updateOrderMutation = useUpdateOrder();

  // Obțin lista unică de magazine din clienți cu filtrare robustă
  const uniqueStores = clients ? 
    Array.from(new Set(
      clients
        .filter(client => client && client.nume_magazin && typeof client.nume_magazin === 'string' && client.nume_magazin.trim() !== '')
        .map(client => client.nume_magazin.trim())
    ))
      .sort()
      .map(store => ({ value: store, label: store }))
    : [];

  // Filtrare robustă pentru produse
  const validProducts = products ? 
    products.filter(product => 
      product && 
      product.id && 
      String(product.id).trim() !== '' && 
      product.nume && 
      typeof product.nume === 'string' && 
      product.nume.trim() !== ''
    ) : [];

  // Filtrare robustă pentru linii
  const validLines = lines ? 
    lines.filter(line => 
      line && 
      line.id && 
      String(line.id).trim() !== '' && 
      line.nume && 
      typeof line.nume === 'string' && 
      line.nume.trim() !== ''
    ) : [];

  const handleSave = async () => {
    if (!magazin.trim()) {
      toast.error("Magazinul este obligatoriu");
      return;
    }

    if (!produsId) {
      toast.error("Produsul este obligatoriu");
      return;
    }

    if (cantitate <= 0) {
      toast.error("Cantitatea trebuie să fie mai mare decât 0");
      return;
    }

    try {
      // Găsesc primul client pentru acest magazin pentru a obține punctul de livrare
      const client = clients?.find(c => c.nume_magazin === magazin);
      const punctLivrare = client?.punct_livrare || order.punct_livrare || "Standard";

      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: {
          magazin: magazin.trim(),
          punct_livrare: punctLivrare,
          produs_id: produsId,
          cantitate: cantitate,
          linie_id: linieId || null,
          status: status
        }
      });

      toast.success("Comanda a fost actualizată cu succes!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Eroare la actualizarea comenzii:', error);
      toast.error("Nu s-a putut actualiza comanda");
    }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Editare Comandă - {order.numar_comanda}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="magazin">Magazin *</Label>
          <Select value={magazin} onValueChange={setMagazin}>
            <SelectTrigger>
              <SelectValue placeholder="Selectați magazinul" />
            </SelectTrigger>
            <SelectContent>
              {uniqueStores.map((store) => (
                <SelectItem key={store.value} value={store.value}>
                  {store.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="produs">Produs *</Label>
          <Select value={produsId} onValueChange={setProdusId}>
            <SelectTrigger>
              <SelectValue placeholder="Selectați produsul" />
            </SelectTrigger>
            <SelectContent>
              {validProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.nume} ({product.unitate_masura})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cantitate">Cantitate *</Label>
          <Input
            id="cantitate"
            type="number"
            min="1"
            value={cantitate}
            onChange={(e) => setCantitate(parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="linie">Linie de Producție</Label>
          <Select value={linieId} onValueChange={setLinieId}>
            <SelectTrigger>
              <SelectValue placeholder="Selectați linia (opțional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-line">Fără linie</SelectItem>
              {validLines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.nume}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Alocată</SelectItem>
              <SelectItem value="in_progress">În progres</SelectItem>
              <SelectItem value="partial">Parțială</SelectItem>
              <SelectItem value="completed">Finalizată</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateOrderMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {updateOrderMutation.isPending ? 'Se salvează...' : 'Salvează Modificările'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};

export default OrderEditDialog;
