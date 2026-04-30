
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, ArrowUpDown } from 'lucide-react';

interface RulesSearchProps {
  searchFilters: {
    produs: string;
    liniePreferata: string;
    prioritate: string;
  };
  setSearchFilters: (filters: any) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  products: any[];
  lines: any[];
}

const RulesSearch = ({ 
  searchFilters, 
  setSearchFilters, 
  sortBy, 
  setSortBy, 
  sortOrder, 
  setSortOrder,
  products, 
  lines 
}: RulesSearchProps) => {
  const updateFilter = (key: string, value: string) => {
    setSearchFilters(prev => ({ ...prev, [key]: value === 'filter-all' ? '' : value }));
  };

  const clearFilters = () => {
    setSearchFilters({
      produs: '',
      liniePreferata: '',
      prioritate: ''
    });
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  // More robust filtering with better value handling
  const validProducts = React.useMemo(() => {
    console.log('RulesSearch - Original products data:', products);
    
    if (!Array.isArray(products)) {
      console.log('RulesSearch - Products is not an array:', products);
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
    
    console.log('RulesSearch - Filtered valid products with safe values:', filtered);
    return filtered;
  }, [products]);

  const validLines = React.useMemo(() => {
    console.log('RulesSearch - Original lines data:', lines);
    
    if (!Array.isArray(lines)) {
      console.log('RulesSearch - Lines is not an array:', lines);
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
    
    console.log('RulesSearch - Filtered valid lines with safe values:', filtered);
    return filtered;
  }, [lines]);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4" />
          <h3 className="font-semibold">Căutare, Filtrare și Sortare Reguli</h3>
          <button 
            onClick={clearFilters}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800"
          >
            Resetează filtrele
          </button>
        </div>
        
        <div className="space-y-4">
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
              <Label>Linie Preferată</Label>
              <Select value={searchFilters.liniePreferata || 'filter-all'} onValueChange={(value) => updateFilter('liniePreferata', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toate liniile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="filter-all">Toate liniile</SelectItem>
                  {validLines.map((line) => (
                    <SelectItem key={line.safeValue} value={line.safeValue}>
                      {line.nume}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioritate</Label>
              <Input
                type="number"
                placeholder="ex: 1, 2, 3..."
                value={searchFilters.prioritate}
                onChange={(e) => updateFilter('prioritate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sortează după</Label>
              <Select value={sortBy || 'produs'} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează criteriul..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produs">Produs</SelectItem>
                  <SelectItem value="linie">Linie Preferată</SelectItem>
                  <SelectItem value="prioritate">Prioritate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Direcția sortării</Label>
              <button
                onClick={toggleSortOrder}
                className="flex items-center justify-center gap-2 w-full h-10 px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
              >
                <ArrowUpDown className="h-4 w-4" />
                {sortOrder === 'asc' ? 'Crescător' : 'Descrescător'}
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RulesSearch;
