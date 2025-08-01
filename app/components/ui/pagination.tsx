"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/app/components/ui/button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  maxVisiblePages?: number
  disabled?: boolean
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 7,
  disabled = false,
  className
}: PaginationProps) {
  if (totalPages <= 1) return null

  const getVisiblePages = () => {
    // If total pages is less than or equal to max visible, show all
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const delta = Math.floor(maxVisiblePages / 2)
    const range = []
    const rangeWithDots = []

    // Calculate the range around current page
    let start = Math.max(2, currentPage - delta)
    let end = Math.min(totalPages - 1, currentPage + delta)

    // Adjust if we're near the beginning
    if (currentPage - delta <= 2) {
      end = Math.min(totalPages - 1, maxVisiblePages - 1)
    }

    // Adjust if we're near the end
    if (currentPage + delta >= totalPages - 1) {
      start = Math.max(2, totalPages - maxVisiblePages + 2)
    }

    // Always include first page
    if (start > 2) {
      rangeWithDots.push(1)
      if (start > 3) {
        rangeWithDots.push('...')
      }
    } else {
      for (let i = 1; i < start; i++) {
        rangeWithDots.push(i)
      }
    }

    // Add the range around current page
    for (let i = start; i <= end; i++) {
      rangeWithDots.push(i)
    }

    // Always include last page
    if (end < totalPages - 1) {
      if (end < totalPages - 2) {
        rangeWithDots.push('...')
      }
      rangeWithDots.push(totalPages)
    } else {
      for (let i = end + 1; i <= totalPages; i++) {
        rangeWithDots.push(i)
      }
    }

    return rangeWithDots
  }

  const visiblePages = getVisiblePages()

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1 || disabled}
        className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>
      
      <div className="flex items-center gap-1">
        {visiblePages.map((page, index) => {
          if (page === '...') {
            return (
              <div key={`dots-${index}`} className="flex h-8 w-8 items-center justify-center">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">More pages</span>
              </div>
            )
          }

          const pageNumber = page as number
          return (
            <Button
              key={pageNumber}
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(pageNumber)}
              disabled={disabled}
              className={cn(
                "!min-w-0 h-8 w-8 p-0 font-medium transition-colors",
                currentPage === pageNumber
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {pageNumber}
            </Button>
          )
        })}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages || disabled}
        className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    </div>
  )
}

export default Pagination