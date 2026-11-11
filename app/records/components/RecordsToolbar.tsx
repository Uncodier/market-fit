"use client"

import { SearchInput } from "@/app/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { useLocalization } from "@/app/context/LocalizationContext"
import { RecordDateFilter } from "./RecordDateFilter"
import type { RecordDateRange } from "../lib/list-filter"

type GroupBy = "status" | "category" | "date" | "team_member"
type SortBy = "newest" | "oldest" | "title_asc" | "title_desc" | "updated_at"

interface RecordsToolbarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  groupBy: GroupBy
  onGroupChange: (value: GroupBy) => void
  dateRange: RecordDateRange
  onDateChange: (value: RecordDateRange) => void
  sortBy: SortBy
  onSortChange: (value: SortBy) => void
  viewType: ViewType
  onViewChange: (value: ViewType) => void
}

function RecordsToolbarOptions({ dateRange, onDateChange, sortBy, onSortChange }: Pick<RecordsToolbarProps,
  "dateRange" | "onDateChange" | "sortBy" | "onSortChange"
>) {
  const { t } = useLocalization()
  return <>
    <FilterSection title={t("records.groupBy.date") || "Date (Month)"}>
      <RecordDateFilter value={dateRange} onChange={onDateChange} />
    </FilterSection>
    <FilterSection title={t("sortBy") || "Sort by"}>
      <SortDropdown sortBy={sortBy} setSortBy={onSortChange} options={[
        { value: "newest", label: t("records.sort.newest") || "Newest" },
        { value: "oldest", label: t("records.sort.oldest") || "Oldest" },
        { value: "updated_at", label: "Updated At" },
        { value: "title_asc", label: t("records.sort.titleAsc") || "Title (A-Z)" },
        { value: "title_desc", label: t("records.sort.titleDesc") || "Title (Z-A)" },
      ]} />
    </FilterSection>
  </>
}

export function RecordsToolbar(props: RecordsToolbarProps) {
  const { t } = useLocalization()
  const groups: { value: GroupBy; label: string }[] = [
    { value: "status", label: t("records.groupBy.status") || "Status" },
    { value: "category", label: t("records.groupBy.category") || "Category" },
    { value: "team_member", label: t("records.groupBy.teamMember") || "Team Member" },
    { value: "date", label: t("records.groupBy.date") || "Date (Month)" },
  ]

  return <div className="flex min-w-0 w-full items-center justify-between gap-2 md:w-auto">
    <MobileFiltersDrawer alwaysModal>
    <FilterContainer className="md:flex-col md:items-stretch md:gap-6">
      <FilterSection title={t("common.search") || "Search"}>
        <SearchInput placeholder={t("records.search") || "Search records..."} value={props.searchQuery}
          onChange={event => props.onSearchChange(event.target.value)}
          alwaysExpanded containerClassName="w-full"
          className="w-full h-10 md:h-9 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" />
      </FilterSection>
      <FilterSection title={t("records.groupBy") || "Group by"}>
        <Select value={props.groupBy} onValueChange={value => props.onGroupChange(value as GroupBy)}>
          <SelectTrigger className="w-full" aria-label={t("records.groupBy") || "Group by"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {groups.map(group => <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterSection>
      <RecordsToolbarOptions {...props} />
    </FilterContainer>
    </MobileFiltersDrawer>
    <div className="ml-auto shrink-0">
      <ViewSelector currentView={props.viewType} onViewChange={props.onViewChange} showCalendar showGraph />
    </div>
  </div>
}