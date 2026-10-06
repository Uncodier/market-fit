import { formatDueDate } from "@/lib/finance/due-date"

export function DueDateSummary({ value }: { value?: string | null }) {
  return <span className="block text-xs text-muted-foreground">Due date: {formatDueDate(value)}</span>
}