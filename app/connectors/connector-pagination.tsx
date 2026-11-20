"use client"

import { Pagination } from "@/app/components/ui/pagination"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"

export function ConnectorPagination({ page, totalPages, hasNext, onPageChange }: {
  page: number; totalPages: number | null; hasNext: boolean; onPageChange: (page: number) => void
}) {
  const { t } = useLocalization()
  const last = totalPages ?? page + (hasNext ? 1 : 0)
  if (last <= 1) return null
  return <nav aria-label={t("connectors.pagination")} className="flex flex-wrap items-center justify-end gap-2">
    <Button variant="ghost" size="sm" onClick={() => onPageChange(1)} disabled={page === 1}>{t("connectors.firstPage")}</Button>
    <Pagination currentPage={page} totalPages={Math.max(page, last)} onPageChange={onPageChange} />
    <Button variant="ghost" size="sm" onClick={() => totalPages && onPageChange(totalPages)}
      disabled={totalPages === null || page >= totalPages}>{t("connectors.lastPage")}</Button>
  </nav>
}