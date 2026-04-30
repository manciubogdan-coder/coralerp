
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { useProducts, useCreateOrder, useClients } from "@/hooks/productie/useProductionData";

interface ProductItem {
  id: string;
  produs_id: string;
  nume_produs: string;
  cantitate: number;
  unitate_masura: string;
}

interface OrderFormNewProps {
  onClose: () => void;
  onSuccess: () => void;
}

const OrderFormNew = ({ onClose, onSuccess }: OrderFormNewProps) => {
  const [magazin, setMagazin] = useState("");
  const [currentProdusId, setCurrentProdusId] = useState("");
  const [currentCantitate, setCurrentCantitate] = useState(1);
  const [produse, setProduse] = useState<ProductItem[]>([]);

  const { data: products } = useProducts();
  const { data: clients } = useClients();
  const createOrderMutation = useCreateOrder();

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

  const handleAdaugaProdus = () => {
    if (!currentProdusId) {
      toast.error("Selectați un produs");
      return;
    }

    if (currentCantitate <= 0) {
      toast.error("Cantitatea trebuie să fie mai mare decât 0");
      return;
    }

    const produs = validProducts?.find(p => p.id === currentProdusId);
    if (!produs) return;

    // Verifică dacă produsul există deja în listă
    const existingIndex = produse.findIndex(p => p.produs_id === currentProdusId);
    
    if (existingIndex >= 0) {
      // Actualizează cantitatea existentă
      const newProduse = [...produse];
      newProduse[existingIndex].cantitate += currentCantitate;
      setProduse(newProduse);
    } else {
      // Adaugă produs nou
      const newProduct: ProductItem = {
        id: Math.random().toString(),
        produs_id: currentProdusId,
        nume_produs: produs.nume,
        cantitate: currentCantitate,
        unitate_masura: produs.unitate_masura
      };
      setProduse([...produse, newProduct]);
    }

    // Reset formular produs
    setCurrentProdusId("");
    setCurrentCantitate(1);
    toast.success("Produs adăugat!");
  };

  const handleStergeProdus = (id: string) => {
    setProduse(produse.filter(p => p.id !== id));
    toast.success("Produs șters!");
  };

  const handleSalveazaComanda = async () => {
    if (!magazin.trim()) {
      toast.error("Magazinul este obligatoriu");
      return;
    }

    if (produse.length === 0) {
      toast.error("Adăugați cel puțin un produs");
      return;
    }

    try {
      // Găsesc primul client pentru acest magazin pentru a obține punctul de livrare
      const client = clients?.find(c => c.nume_magazin === magazin);
      const punctLivrare = client?.punct_livrare || "Standard";

      // Creez o comandă pentru fiecare produs
      for (const produs of produse) {
        await createOrderMutation.mutateAsync({
          magazin: magazin.trim(),
          punct_livrare: punctLivrare,
          produs_id: produs.produs_id,
          cantitate: produs.cantitate,
          status: 'pending'
        });
      }

      toast.success(`Comandă creată cu succes cu ${produse.length} produse!`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Eroare la salvarea comenzii:', error);
      toast.error("Nu s-a putut salva comanda");
    }
  };

  return (
    <div className="max-h-[85vh] overflow-y-auto">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold">Comandă Nouă</h2>
          <p className="text-sm text-muted-foreground">Adăugați detaliile comenzii și produsele dorite</p>
        </div>

        {/* Informații magazin - compact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-4 w-4" />
              Magazin
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Adăugare produse - compact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Produse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-end">
              <div className="sm:col-span-7">
                <Label htmlFor="produs" className="text-sm">Produs</Label>
                <Select value={currentProdusId} onValueChange={setCurrentProdusId}>
                  <SelectTrigger className="h-9">
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
              
              <div className="sm:col-span-3">
                <Label htmlFor="cantitate" className="text-sm">Cantitate</Label>
                <Input
                  id="cantitate"
                  type="number"
                  min="1"
                  value={currentCantitate}
                  onChange={(e) => setCurrentCantitate(parseInt(e.target.value) || 1)}
                  className="h-9"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Button 
                  onClick={handleAdaugaProdus}
                  className="w-full h-9"
                  disabled={!currentProdusId}
                  size="sm"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Adaugă
                </Button>
              </div>
            </div>

            {/* Lista produselor adăugate - compact */}
            {produse.length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium mb-2">Produse adăugate ({produse.length})</div>
                <div className="max-h-32 overflow-y-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-8">
                        <TableHead className="text-xs py-1">Produs</TableHead>
                        <TableHead className="text-xs py-1 w-20">Cantitate</TableHead>
                        <TableHead className="text-xs py-1 w-16">Acțiuni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produse.map((produs) => (
                        <TableRow key={produs.id} className="h-8">
                          <TableCell className="text-xs py-1">{produs.nume_produs}</TableCell>
                          <TableCell className="text-xs py-1">{produs.cantitate} {produs.unitate_masura}</TableCell>
                          <TableCell className="py-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleStergeProdus(produs.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Butoane finale - compact */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Anulează
          </Button>
          <Button 
            onClick={handleSalveazaComanda}
            disabled={createOrderMutation.isPending || produse.length === 0}
            className="bg-green-600 hover:bg-green-700"
            size="sm"
          >
            {createOrderMutation.isPending ? 'Se salvează...' : `Salvează Comanda (${produse.length} produse)`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderFormNew;
