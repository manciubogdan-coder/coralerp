
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';

interface OrderSearchProps {
  searchFilters: {
    produs: string;
    cantitate: string;
    magazin: string;
    linie: string;
    dataCrearii: string;
  };
  setSearchFilters: (filters: any) => void;
  products: any[];
  lines: any[];
}

const OrderSearch = ({ searchFilters, setSearchFilters, products, lines }: OrderSearchProps) => {
  const updateFilter = (key: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value === 'all' ? '' : value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      produs: '',
      cantitate: '',
      magazin: '',
      linie: '',
      dataCrearii: ''
    });
  };

  // More robust filtering with better value handling
  const validProducts = React.useMemo(() => {
    console.log('OrderSearch - Original products data:', products);
    
    if (!Array.isArray(products)) {
      console.log('OrderSearch - Products is not an array:', products);
      return [];
    }
    
    const filtered = products.filter(product => {
      if (!product) return false;
      if (!product.hasOwnProperty('id') || product.id === null || product.id === undefined) return false;
      
      const idString = String(product.id).trim();
      if (idString === '' || idString === 'null' || idString === 'undefined') return false;
      if (!product.nume || typeof product.nume !== 'string' || product.nume.trim() === '') return false;
      
      return true;
    }).map(product => ({
      ...product,
      safeValue: `product-${product.id}`
    }));
    
    console.log('OrderSearch - Filtered valid products with safe values:', filtered);
    return filtered;
  }, [products]);

  const validLines = React.useMemo(() => {
    console.log('OrderSearch - Original lines data:', lines);
    
    if (!Array.isArray(lines)) {
      console.log('OrderSearch - Lines is not an array:', lines);
      return [];
    }
    
    const filtered = lines.filter(line => {
      if (!line) return false;
      if (!line.hasOwnProperty('id') || line.id === null || line.id === undefined) return false;
      
      const idString = String(line.id).trim();
      if (idString === '' || idString === 'null' || idString === 'undefined') return false;
      if (!line.nume || typeof line.nume !== 'string' || line.nume.trim() === '') return false;
      
      return true;
    }).map(line => ({
      ...line,
      safeValue: `line-${line.id}`
    }));
    
    console.log('OrderSearch - Filtered valid lines with safe values:', filtered);
    return filtered;
  }, [lines]);

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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Produs</Label>
            <Select value={searchFilters.produs || 'all'} onValueChange={(value) => updateFilter('produs', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate produsele" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate produsele</SelectItem>
                {validProducts.map((product) => (
                  <SelectItem key={product.safeValue} value={product.safeValue}>
                    {product.nume}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cantitate minimă</Label>
            <Input
              type="number"
              placeholder="ex: 100"
              value={searchFilters.cantitate}
              onChange={(e) => updateFilter('cantitate', e.target.value)}
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
            <Label>Linie</Label>
            <Select value={searchFilters.linie || 'all'} onValueChange={(value) => updateFilter('linie', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Toate liniile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toate liniile</SelectItem>
                <SelectItem value="unassigned">Nealocate</SelectItem>
                {validLines.map((line) => (
                  <SelectItem key={line.safeValue} value={line.safeValue}>
                    {line.nume}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data creării</Label>
            <Input
              type="date"
              value={searchFilters.dataCrearii}
              onChange={(e) => updateFilter('dataCrearii', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSearch;
