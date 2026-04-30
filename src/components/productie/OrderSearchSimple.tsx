
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface OrderSearchSimpleProps {
  searchFilters: {
    numarComanda: string;
    magazin: string;
    status: string;
    linie: string;
  };
  setSearchFilters: (filters: any) => void;
}

const OrderSearchSimple = ({ searchFilters, setSearchFilters }: OrderSearchSimpleProps) => {
  const updateFilter = (key: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      numarComanda: '',
      magazin: '',
      status: '',
      linie: ''
    });
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4" />
          <h3 className="font-semibold">Căutare și Filtrare Comenzi</h3>
          <button 
            onClick={clearFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Resetează filtrele
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Număr Comandă</Label>
            <Input
              placeholder="Caută după numărul comenzii..."
              value={searchFilters.numarComanda}
              onChange={(e) => updateFilter('numarComanda', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Magazin</Label>
            <Input
              placeholder="Caută după magazin..."
              value={searchFilters.magazin}
              onChange={(e) => updateFilter('magazin', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={searchFilters.status} onValueChange={(value) => updateFilter('status', value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate statusurile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate statusurile</SelectItem>
                <SelectItem value="pending">În așteptare</SelectItem>
                <SelectItem value="assigned">Alocată</SelectItem>
                <SelectItem value="in_progress">În progres</SelectItem>
                <SelectItem value="partial">Parțial finalizată</SelectItem>
                <SelectItem value="completed">Finalizată</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Linie de producție</Label>
            <Input
              placeholder="Caută după linie..."
              value={searchFilters.linie}
              onChange={(e) => updateFilter('linie', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSearchSimple;
