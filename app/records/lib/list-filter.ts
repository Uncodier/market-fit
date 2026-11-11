import { endOfDay, isValid, parseISO, startOfDay } from "date-fns"

export type RecordDateRange = { startDate: Date; endDate: Date } | null
export type RecordListFilter = {
  categoryId: string
  relation: { fieldName: string; targetId: string } | null
  search: string
  dateRange: RecordDateRange
}

export function matchesRecordListFilter(record: {
  category_id: string
  title: string
  created_at: string
  relations: Record<string, unknown> | null
}, filter: RecordListFilter): boolean {
  if (filter.categoryId !== "all" && record.category_id !== filter.categoryId) return false
  if (filter.relation && record.relations?.[filter.relation.fieldName] !== filter.relation.targetId) return false
  if (filter.search.trim() && !record.title.toLowerCase().includes(filter.search.trim().toLowerCase())) return false
  if (!filter.dateRange) return true
  const created = parseISO(record.created_at)
  return isValid(created) && created >= startOfDay(filter.dateRange.startDate)
    && created <= endOfDay(filter.dateRange.endDate)
}

export function recordListPage(page: number, count: number, pageSize: number): number {
  return Math.max(1, Math.min(page, Math.ceil(count / pageSize)))
}