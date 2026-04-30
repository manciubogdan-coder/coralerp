
import { useState, useMemo } from 'react';
import { ProductieComanda } from './useProductionData';

interface UseOrdersPaginationProps {
  orders: ProductieComanda[];
  initialPageSize?: number;
}

export const useOrdersPagination = ({ orders, initialPageSize = 25 }: UseOrdersPaginationProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = orders.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return orders.slice(startIndex, endIndex);
  }, [orders, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Reset to first page when orders change (e.g., after filtering)
  const resetPagination = () => {
    setCurrentPage(1);
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedOrders,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  };
};
