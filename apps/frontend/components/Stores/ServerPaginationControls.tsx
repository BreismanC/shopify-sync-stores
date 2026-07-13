"use client";

import Button from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

  if (pageCount <= 1) {
    return null;
  }

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

  const renderPageNumbers = (showAll = false) => {
    if (!showAll) {
      return (
        <div className="flex items-center gap-1 text-xs text-gray-11 md:hidden">
          <span className="font-medium text-gray-12">{currentPage}</span>
          <span>/</span>
          <span>{pageCount}</span>
        </div>
      );
    }

    if (pageCount <= 4) {
      return Array.from({ length: pageCount }, (_, i) => {
        const pageNum = i + 1;
        const isActive = currentPage === pageNum;
        return (
          <Button
            key={i}
            mode={isActive ? "fill" : "pill"}
            size="sm"
            onClick={() => handlePageChange(pageNum)}
            className={
              isActive
                ? "bg-primary border-primary text-normal text-background"
                : "bg-gray-2 border-gray-3 text-normal text-foreground"
            }
          >
            {pageNum}
          </Button>
        );
      });
    }

    const pages: React.ReactNode[] = [];

    pages.push(
      <Button
        key={0}
        mode={currentPage === 1 ? "fill" : "pill"}
        size="sm"
        onClick={() => handlePageChange(1)}
        className={
          currentPage === 1
            ? "bg-primary border-primary text-normal text-background"
            : "bg-gray-2 border-gray-3 text-normal text-foreground"
        }
      >
        1
      </Button>
    );

    if (currentPage <= 3) {
      for (let i = 2; i <= 4; i++) {
        pages.push(
          <Button
            key={i}
            mode={currentPage === i ? "fill" : "pill"}
            size="sm"
            onClick={() => handlePageChange(i)}
            className={
              currentPage === i
                ? "bg-primary border-primary text-normal text-background"
                : "bg-gray-2 border-gray-3 text-normal text-foreground"
            }
          >
            {i}
          </Button>
        );
      }
      if (pageCount > 4) {
        pages.push(
          <span
            key="ellipsis1"
            className="px-2 text-muted-foreground text-gray-11"
          >
            ...
          </span>
        );
        pages.push(
          <Button
            key={pageCount}
            mode={currentPage === pageCount ? "fill" : "pill"}
            size="sm"
            onClick={() => handlePageChange(pageCount)}
            className={
              currentPage === pageCount
                ? "bg-primary border-primary text-normal text-background"
                : "bg-gray-2 border-gray-3 text-normal text-foreground"
            }
          >
            {pageCount}
          </Button>
        );
      }
    } else if (currentPage >= pageCount - 2) {
      pages.push(
        <span
          key="ellipsis2"
          className="px-2 text-muted-foreground text-gray-11"
        >
          ...
        </span>
      );
      for (let i = pageCount - 3; i <= pageCount; i++) {
        pages.push(
          <Button
            key={i}
            mode={currentPage === i ? "fill" : "pill"}
            size="sm"
            onClick={() => handlePageChange(i)}
            className={
              currentPage === i
                ? "bg-primary border-primary text-normal text-background"
                : "bg-gray-2 border-gray-3 text-normal text-foreground"
            }
          >
            {i}
          </Button>
        );
      }
    } else {
      pages.push(
        <span
          key="ellipsis3"
          className="px-0.5 text-muted-foreground"
        >
          ...
        </span>
      );
      pages.push(
        <Button
          key={currentPage}
          mode="fill"
          size="sm"
          onClick={() => handlePageChange(currentPage)}
          className="bg-primary border-primary text-normal text-background"
        >
          {currentPage}
        </Button>
      );
      pages.push(
        <span
          key="ellipsis4"
          className="px-0.5 text-muted-foreground"
        >
          ...
        </span>
      );
      pages.push(
        <Button
          key={pageCount}
          mode={currentPage === pageCount ? "fill" : "pill"}
          size="sm"
          onClick={() => handlePageChange(pageCount)}
          className={
            currentPage === pageCount
              ? "bg-primary border-primary text-normal text-background"
              : "bg-gray-2 border-gray-3 text-normal text-foreground"
          }
        >
          {pageCount}
        </Button>
      );
    }

    return pages;
  };

  const startItem = (currentPage - 1) * pagination.perPage + 1;
  const endItem = Math.min(
    currentPage * pagination.perPage,
    pagination.total
  );

  return (
    <div
      className={`flex flex-col gap-2 lg:flex-row items-center justify-between lg:gap-0 px-2 py-4 ${className}`}
    >
      <div className="text-xs sm:text-sm text-muted-foreground text-gray-10 text-center md:text-left">
        <span className="hidden sm:inline">Mostrando </span>
        <span className="font-medium text-gray-12">{startItem}</span>
        <span className="hidden sm:inline"> - </span>
        <span className="sm:hidden">-</span>
        <span className="font-medium text-gray-12">{endItem}</span>
        <span className="hidden sm:inline"> de </span>
        <span className="sm:hidden">/</span>
        <span className="font-medium text-gray-12">{pagination.total}</span>
        <span className="hidden sm:inline"> resultados</span>
      </div>

      <div className="flex items-center gap-1 md:space-x-1">
        <div className="flex items-center gap-1 md:space-x-2">
          <Button
            mode="fill"
            size="sm"
            onClick={handlePrevious}
            isDisabled={currentPage <= 1}
            className="bg-gray-3 border-gray-4 text-normal text-foreground"
          >
            <ChevronLeft className="size-3" />
          </Button>

          {renderPageNumbers(false)}

          <div className="hidden md:flex items-center space-x-1 border-gray-2 text-normal">
            {renderPageNumbers(true)}
          </div>

          <Button
            mode="fill"
            size="sm"
            onClick={handleNext}
            isDisabled={currentPage >= pageCount}
            className="bg-gray-3 border-gray-4 text-normal text-foreground"
          >
            <ChevronRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}