"use client"

import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { useLocalization } from "@/app/context/LocalizationContext"
import { LeadsTransferActions, type LeadsTransferActionsProps } from "./LeadsTransferActions"

interface LeadsToolbarProps extends Omit<LeadsTransferActionsProps, "mobile"> {
  sortBy: string
  onSortChange: (value: string) => void
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function LeadsToolbar({
  segments,
  onImportLeads,
  onExportLeads,
  sortBy,
  onSortChange,
  currentView,
  onViewChange,
}: LeadsToolbarProps) {
  const { t } = useLocalization()

  return (
    <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none md:shrink-0">
      <LeadsTransferActions segments={segments} onImportLeads={onImportLeads} onExportLeads={onExportLeads} />
      <div className="mx-1 hidden h-6 w-px bg-border md:block" />
      <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
        <div className="min-w-0 flex-1 md:flex-none">
          <SortDropdown
            sortBy={sortBy}
            setSortBy={onSortChange}
            className="min-w-0 px-3 md:px-4"
            options={[
              { value: "newest", label: t("leads.sort.newest") || "Newest" },
              { value: "oldest", label: t("leads.sort.oldest") || "Oldest" },
              { value: "nearest_due_date", label: "Nearest due date" },
              { value: "last_updated", label: "Last updated" },
            ]}
          />
        </div>
        <div className="shrink-0">
          <ViewSelector currentView={currentView} onViewChange={onViewChange} />
        </div>
      </div>
    </div>
  )
}