"use client"

import { ProgressiveStatusBar } from "@/app/components/ui/progressive-status-bar"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"
import type { SupplierInput } from "../schema"

type Status = SupplierInput["status"]
const forwardPath: Status[] = ["prospect", "under_review", "approved"]
const outcomes: Status[] = ["blocked", "archived"]
const styles: Record<Status, string> = {
  prospect: "bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950 dark:text-blue-300",
  under_review: "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
  blocked: "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300",
  archived: "bg-muted text-muted-foreground border border-border",
}

export function SupplierStatusWidget({ status, disabled, onChange, onArchive }: {
  status: Status; disabled: boolean; onChange: (status: Status) => void; onArchive: () => void
}) {
  const { valueLabel } = useProcurementI18n()
  return <div role="group" aria-label="Supplier status" aria-disabled={disabled} className="min-w-0 max-w-[55%] shrink-0 overflow-x-auto">
    <ProgressiveStatusBar current={status} forwardPath={forwardPath} outcomes={outcomes}
      styles={styles} labels={valueLabel} disabled={disabled || status === "archived"}
      onChange={next => { if (disabled || status === "archived") return; if (next === "archived") onArchive(); else onChange(next) }} />
  </div>
}