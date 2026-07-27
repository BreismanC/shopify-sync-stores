"use client";

import type { PaginationMeta } from "./types";

interface ServerPaginationControlsProps {
  pagination: PaginationMeta;
  onPageChange?: (page: number) => void;
  currentPage: number;
  className?: string;
}

export function ServerPaginationControls({
  pagination,
  onPageChange,
  currentPage,
  className = "",
}: ServerPaginationControlsProps) {
  const pageCount = pagination.lastPage || pagination.totalPages || 1;

  const handlePageChange = (newPage: number) => {
    if (onPageChange && newPage >= 1 && newPage <= pageCount) {
      onPageChange(newPage);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < pageCount) {
      handlePageChange(currentPage + 1);
    }
  };

  const startItem =
    pagination.total > 0 ? (currentPage - 1) * pagination.perPage + 1 : 0;
  const endItem = Math.min(
    currentPage * pagination.perPage,
    pagination.total,
  );

  return (
    <nav
      aria-label="Navegación de la tabla"
      className={`flex flex-col sm:flex-row items-center justify-between p-4 gap-4 border-t border-gray-200 dark:border-gray-800 ${className}`}
    >
      <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
        Mostrando{" "}
        <span className="font-semibold text-gray-900 dark:text-white">
          {startItem}-{endItem}
        </span>{" "}
        de{" "}
        <span className="font-semibold text-gray-900 dark:text-white">
          {pagination.total}
        </span>
      </span>
      <div className="inline-flex items-center -space-x-px text-sm h-8">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          className="flex items-center justify-center px-3 h-8 ml-0 leading-tight text-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-l-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Anterior
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= pageCount}
          className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-r-lg hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Siguiente
        </button>
      </div>
    </nav>
  );
}