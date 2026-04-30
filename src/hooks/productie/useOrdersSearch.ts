
import { useMemo } from 'react';
import { ProductieComanda } from './useProductionData';

interface OrderSearchFilters {
  produs: string;
  cantitate: string;
  magazin: string;
  linie: string;
  dataCrearii: string;
}

export const useOrdersSearch = (orders: ProductieComanda[], filters: OrderSearchFilters) => {
  return useMemo(() => {
    return orders.filter(order => {
      // Filtrare după produs
      if (filters.produs && order.produs_id !== filters.produs) {
        return false;
      }

      // Filtrare după cantitate minimă
      if (filters.cantitate && order.cantitate < parseInt(filters.cantitate)) {
        return false;
      }

      // Filtrare după magazin
      if (filters.magazin && !order.magazin.toLowerCase().includes(filters.magazin.toLowerCase())) {
        return false;
      }

      // Filtrare după linie
      if (filters.linie) {
        if (filters.linie === 'unassigned' && order.linie_id) {
          return false;
        }
        if (filters.linie !== 'unassigned' && order.linie_id !== filters.linie) {
          return false;
        }
      }

      // Filtrare după data creării
      if (filters.dataCrearii) {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        if (orderDate !== filters.dataCrearii) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filters]);
};
