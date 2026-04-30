
import { useState, useMemo } from 'react';

interface ProductieLinie {
  id: string;
  nume: string;
  status: string;
  capacitate_ora: number;
  created_at: string;
  updated_at: string;
}

interface UseLinesPaginationProps {
  lines: ProductieLinie[];
  initialPageSize?: number;
}

export const useLinesPagination = ({ lines, initialPageSize = 25 }: UseLinesPaginationProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalItems = lines.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedLines = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return lines.slice(startIndex, endIndex);
  }, [lines, currentPage, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Reset to first page when lines change (e.g., after filtering)
  const resetPagination = () => {
    setCurrentPage(1);
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedLines,
    handlePageChange,
    handlePageSizeChange,
    resetPagination
  };
};
