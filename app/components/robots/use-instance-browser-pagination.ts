"use client"

import { useState } from "react"

/** Content-based identity avoids resets on status-only/referential list updates. */
export function useInstanceBrowserPagination(ids: string[], itemsPerPage: number) {
  const key = JSON.stringify(ids)
  const totalPages = Math.max(1, Math.ceil(ids.length / itemsPerPage))
  const [selection, setSelection] = useState({ key, page: 1 })
  const currentPage = selection.key === key ? Math.min(selection.page, totalPages) : 1
  // Guarded render-time adjustment keeps pagination and rows consistent in this
  // render, without a second effect-driven update or resurrecting stale pages.
  if (selection.key !== key || selection.page !== currentPage) {
    setSelection({ key, page: currentPage })
  }
  const setCurrentPage = (page: number) => {
    setSelection({ key, page: Math.max(1, Math.min(page, totalPages)) })
  }
  return { currentPage, totalPages, setCurrentPage }
}