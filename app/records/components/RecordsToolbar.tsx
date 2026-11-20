"use client"

import { SearchInput } from "@/app/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { MobileFiltersDrawer, FilterContainer, FilterSection } from "@/app/components/ui/mobile-filters-drawer"
import { SortDropdown } from "@/app/components/ui/sort-dropdown"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
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

export function RecordsToolbar(props: RecordsToolbarProps) {
  const { t } = useLocalization()
  const isMobile = useIsMobile()
  const groups: { value: GroupBy; label: string }[] = [
    { value: "status", label: t("records.groupBy.status") || "Status" },
    { value: "category", label: t("records.groupBy.category") || "Category" },
    { value: "team_member", label: t("records.groupBy.teamMember") || "Team Member" },
    { value: "date", label: t("records.groupBy.date") || "Date (Month)" },
  ]

  const search = (
    <SearchInput placeholder={t("records.search") || "Search records..."} value={props.searchQuery}
      onChange={event => props.onSearchChange(event.target.value)}
      alwaysExpanded={isMobile} containerClassName={isMobile ? "w-full" : "w-64 max-w-full"}
      className="w-full h-10 md:h-9 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" />
  )
  const groupBy = (
    <Select value={props.groupBy} onValueChange={value => props.onGroupChange(value as GroupBy)}>
      <SelectTrigger className="w-full max-w-full md:w-[180px]" aria-label={t("records.groupBy") || "Group by"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groups.map(group => <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const dates = <RecordDateFilter value={props.dateRange} onChange={props.onDateChange} />
  const sort = <SortDropdown sortBy={props.sortBy} setSortBy={props.onSortChange} options={[
    { value: "newest", label: t("records.sort.newest") || "Newest" },
    { value: "oldest", label: t("records.sort.oldest") || "Oldest" },
    { value: "updated_at", label: "Updated At" },
    { value: "title_asc", label: t("records.sort.titleAsc") || "Title (A-Z)" },
    { value: "title_desc", label: t("records.sort.titleDesc") || "Title (Z-A)" },
  ]} />
  const views = <ViewSelector currentView={props.viewType} onViewChange={props.onViewChange} showCalendar showGraph />

  if (isMobile) {
    return (
      <div className="flex w-full min-w-0 items-center justify-between gap-2">
        <MobileFiltersDrawer>
          <FilterContainer>
            <FilterSection title={t("common.search") || "Search"}>{search}</FilterSection>
            <FilterSection title={t("records.groupBy") || "Group by"}>{groupBy}</FilterSection>
            <FilterSection title={t("records.groupBy.date") || "Date (Month)"}>{dates}</FilterSection>
            <FilterSection title={t("sortBy") || "Sort by"}>{sort}</FilterSection>
          </FilterContainer>
        </MobileFiltersDrawer>
        <div className="ml-auto shrink-0">{views}</div>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        {search}
        {groupBy}
      </div>
      <div className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
        {dates}
        {sort}
        {views}
      </div>
    </div>
  )
}