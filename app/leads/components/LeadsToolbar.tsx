"use client"

import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { useLocalization } from "@/app/context/LocalizationContext"

interface LeadsToolbarProps {
  sortBy: string
  onSortChange: (value: string) => void
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function LeadsToolbar({
  sortBy,
  onSortChange,
  currentView,
  onViewChange,
}: LeadsToolbarProps) {
  const { t } = useLocalization()
  const sortLabel = t("content.sortBy")

  return (
    <>
        <SortDropdown
          sortBy={sortBy}
          setSortBy={onSortChange}
          title={sortLabel === "content.sortBy" ? "Sort by" : sortLabel}
          options={[
            { value: "newest", label: t("leads.sort.newest") || "Newest" },
            { value: "oldest", label: t("leads.sort.oldest") || "Oldest" },
            { value: "nearest_due_date", label: "Nearest due date" },
            { value: "last_updated", label: "Last updated" },
          ]}
        />
        <ViewSelector currentView={currentView} onViewChange={onViewChange} />
    </>
  )
}