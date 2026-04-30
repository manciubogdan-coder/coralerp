
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface DistributionSearchProps {
  searchFilters: {
    produs: string;
    linie: string;
    magazin: string;
  };
  setSearchFilters: (filters: any) => void;
  products: any[];
  lines: any[];
}

const DistributionSearch = ({ searchFilters, setSearchFilters, products, lines }: DistributionSearchProps) => {
  const updateFilter = (key: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value === 'filter-all' ? '' : value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      produs: '',
      linie: '',
      magazin: ''
    });
  };

  // Filtrare robustă pentru produse
  const validProducts = React.useMemo(() => {
    if (!Array.isArray(products)) {
      return [];
    }
    
    return products.filter(product => {
      return product && 
             product.id && 
             String(product.id).trim() !== '' && 
             product.nume && 
             typeof product.nume === 'string' && 
             product.nume.trim() !== '';
    }).map(product => ({
      ...product,
      safeValue: `product-${product.id}`
    }));
  }, [products]);

  // Filtrare robustă pentru linii
  const validLines = React.useMemo(() => {
    if (!Array.isArray(lines)) {
      return [];
    }
    
    return lines.filter(line => {
      return line && 
             line.id && 
             String(line.id).trim() !== '' && 
             line.nume && 
             typeof line.nume === 'string' && 
             line.nume.trim() !== '';
    }).map(line => ({
      ...line,
      safeValue: `line-${line.id}`
    }));
  }, [lines]);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4" />
          <h3 className="font-semibold">Căutare și Filtrare Distribuire</h3>
          <button 
            onClick={clearFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Resetează filtrele
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Produs</Label>
            <Select value={searchFilters.produs || 'filter-all'} onValueChange={(value) => updateFilter('produs', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate produsele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filter-all">Toate produsele</SelectItem>
                {validProducts.map((product) => (
                  <SelectItem key={product.safeValue} value={product.safeValue}>
                    {product.nume}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Linie</Label>
            <Select value={searchFilters.linie || 'filter-all'} onValueChange={(value) => updateFilter('linie', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate liniile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filter-all">Toate liniile</SelectItem>
                <SelectItem value="unassigned">Neatribuite</SelectItem>
                {validLines.map((line) => (
                  <SelectItem key={line.safeValue} value={line.safeValue}>
                    {line.nume}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Magazin</Label>
            <Input
              placeholder="Caută după magazin..."
              value={searchFilters.magazin}
              onChange={(e) => updateFilter('magazin', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DistributionSearch;
