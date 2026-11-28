"use client"

import { SearchInput } from "@/app/components/ui/search-input"
import { Select, SelectContent, SelectItem, SelectIconTrigger } from "@/app/components/ui/select"
import { ModifierGroups } from "@/app/components/ui/icons"
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

export function RecordsToolbar(props: RecordsToolbarProps) {
  const { t } = useLocalization()
  const groups: { value: GroupBy; label: string }[] = [
    { value: "status", label: t("records.groupBy.status") || "Status" },
    { value: "category", label: t("records.groupBy.category") || "Category" },
    { value: "team_member", label: t("records.groupBy.teamMember") || "Team Member" },
    { value: "date", label: t("records.groupBy.date") || "Date (Month)" },
  ]
  const groupLabel = t("records.groupBy") || "Group by"
  const activeGroupLabel = groups.find(group => group.value === props.groupBy)?.label
  const localizedSortLabel = t("content.sortBy")
  const sortLabel = localizedSortLabel === "content.sortBy" ? "Sort by" : localizedSortLabel

  const search = (mobile = false) => (
    <SearchInput placeholder={t("records.search") || "Search records..."} value={props.searchQuery}
      onChange={event => props.onSearchChange(event.target.value)}
      alwaysExpanded={mobile} containerClassName={mobile ? "w-full" : "w-64 max-w-full"}
      className="w-full h-10 md:h-9 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20" />
  )
  const groupBy = (
    <Select value={props.groupBy} onValueChange={value => props.onGroupChange(value as GroupBy)}>
      <SelectIconTrigger label={groupLabel} tooltipLabel={activeGroupLabel ? `${groupLabel}: ${activeGroupLabel}` : groupLabel}>
        <ModifierGroups className="h-4 w-4" aria-hidden />
      </SelectIconTrigger>
      <SelectContent>
        {groups.map(group => <SelectItem key={group.value} value={group.value}>{group.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
  const dates = <RecordDateFilter value={props.dateRange} onChange={props.onDateChange} />
  const sort = <SortDropdown sortBy={props.sortBy} setSortBy={props.onSortChange} title={sortLabel} options={[
    { value: "newest", label: t("records.sort.newest") || "Newest" },
    { value: "oldest", label: t("records.sort.oldest") || "Oldest" },
    { value: "updated_at", label: "Updated At" },
    { value: "title_asc", label: t("records.sort.titleAsc") || "Title (A-Z)" },
    { value: "title_desc", label: t("records.sort.titleDesc") || "Title (Z-A)" },
  ]} />
  const views = <ViewSelector currentView={props.viewType} onViewChange={props.onViewChange} showCalendar showGraph />

  return (
    <MobileFiltersDrawer controls={views}>
      <FilterContainer>
        <FilterSection mobileOnly title={t("common.search") || "Search"}>{search(true)}</FilterSection>
        <FilterSection zone="search" desktopOnly>{search()}</FilterSection>
        <FilterSection title={groupLabel}>{groupBy}</FilterSection>
        <FilterSection title={t("common.dateRange") || "Date range"}>{dates}</FilterSection>
        <FilterSection title={sortLabel}>{sort}</FilterSection>
      </FilterContainer>
    </MobileFiltersDrawer>
  )
}