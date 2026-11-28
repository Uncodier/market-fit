"use client"

import React, { useState, Children, Fragment, createContext, useContext, isValidElement, cloneElement } from "react"
import { Filter, MoreVertical } from "@/app/components/ui/icons"
import { ToolbarIconButton } from "@/app/components/ui/toolbar-icon-button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { cn } from "@/lib/utils"
import { stickyHeaderSelectClassName } from "./sticky-header-styles"
import { ListToolbar } from "./list-toolbar"

const InFiltersDrawer = createContext(false)
type FilterZone = "search" | "tabs" | "actions" | "controls"
type FilterContainerProps = { children: React.ReactNode; className?: string; actions?: React.ReactNode; controls?: React.ReactNode; tabs?: React.ReactNode }

function isFilterSection(section: React.ReactNode): section is React.ReactElement<FilterSectionProps> {
  return isValidElement<FilterSectionProps>(section) && section.type === FilterSection
}

function isToolbarSearch(section: React.ReactNode): section is React.ReactElement<FilterSectionProps> {
  return isFilterSection(section) && section.props.zone === "search" && !section.props.mobileOnly
}

function getDrawerSections(sections: React.ReactNode[]) {
  const hasSearch = sections.some(isToolbarSearch)
  return sections.filter(section => !isFilterSection(section) || (!section.props.desktopOnly &&
    (section.props.zone !== "tabs" || section.props.mobileOnly) && !(hasSearch && section.props.zone === "search")))
}

export function FilterContainer({ children, className, actions, controls, tabs }: FilterContainerProps) {
  const inDrawer = useContext(InFiltersDrawer)
  const sections = Children.toArray(children)

  if (!inDrawer) {
    const groups: Record<FilterZone, React.ReactNode[]> = { search: [], tabs: [], actions: [], controls: [] }
    for (const section of sections) {
      if (isFilterSection(section)) {
        if (!section.props.mobileOnly) groups[section.props.zone ?? "controls"].push(section)
      } else if (!isValidElement(section) || section.type !== FilterSeparator) {
        groups.controls.push(section)
      }
    }
    return (
      <ListToolbar className={className}
        search={groups.search.length > 0 && groups.search}
        tabs={(tabs || groups.tabs.length > 0) && <>{tabs}{groups.tabs}</>}
        actions={(actions || groups.actions.length > 0) && <>{actions}{groups.actions}</>}
        controls={(controls || groups.controls.length > 0) && <>{groups.controls}{controls}</>}
      />
    )
  }

  const drawerSections = getDrawerSections(sections)
  return (
    <div className={cn("flex w-full min-w-0 flex-col items-stretch gap-6", className)}>
      {drawerSections.map((child, index) => {
        const isLast = index === drawerSections.length - 1
        return (
          <Fragment key={index}>
            {child}
            {!isLast && <div className="h-px bg-border md:hidden w-full opacity-50" />}
          </Fragment>
        )
      })}
    </div>
  )
}

interface FilterSectionProps {
  children: React.ReactNode
  title?: string
  helper?: string
  mobileOnly?: boolean
  desktopOnly?: boolean
  zone?: FilterZone
  className?: string
}

export function FilterSection({
  children,
  title,
  helper,
  mobileOnly,
  desktopOnly,
  className
}: FilterSectionProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2.5 md:gap-0 w-full md:w-auto",
      mobileOnly && "md:hidden",
      desktopOnly && "max-md:hidden",
      className
    )}>
      {title && <span className="text-[11px] font-bold text-muted-foreground md:hidden uppercase tracking-wider">{title}</span>}
      {children}
      {helper && <p className="text-xs text-muted-foreground mt-1 md:hidden">{helper}</p>}
    </div>
  )
}

export function FilterSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border md:hidden w-full", className)} />
}

interface MobileFiltersDrawerProps {
  children: React.ReactNode
  triggerText?: string
  results?: React.ReactNode
  alwaysModal?: boolean
  layout?: "default" | "compact"
  actions?: React.ReactNode
  controls?: React.ReactNode
  tabs?: React.ReactNode
}

export function MobileFiltersDrawer({ children, triggerText, results, alwaysModal = false, layout = "default", actions, controls, tabs }: MobileFiltersDrawerProps) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const container = isValidElement<FilterContainerProps>(children) && children.type === FilterContainer ? children : null

  if (!isMobile && !alwaysModal) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {container ? cloneElement(container, { actions, controls, tabs }) : children}
      </div>
    )
  }

  const sections = !alwaysModal && container ? Children.toArray(container.props.children) : []
  const search = sections.find(isToolbarSearch)
  const mobileTabs = sections.filter(section => isFilterSection(section) && section.props.zone === "tabs" && !section.props.mobileOnly && !section.props.desktopOnly)
  const label = search && (!triggerText || triggerText === t("common.search")) ? t("common.filters") : triggerText || t("common.search") || "Search & Filters"
  const triggerLabel = label && label !== "common.filters" ? label : "Filters"
  const drawer = (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <ToolbarIconButton label={triggerLabel} variant={alwaysModal ? "ghost" : "secondary"}>
            {alwaysModal ? <MoreVertical className="h-4 w-4" aria-hidden /> : <Filter className="h-4 w-4" aria-hidden />}
          </ToolbarIconButton>
        </SheetTrigger>
        <SheetContent side="right" aria-describedby={undefined} className="w-[85vw] sm:max-w-md p-0 flex flex-col bg-background">
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle className="text-left font-semibold text-lg">{triggerLabel}</SheetTitle>
          </SheetHeader>
          <div className={cn(
            "flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-6 flex flex-col gap-6",
            layout === "default" && "mobile-filters-drawer-content",
            stickyHeaderSelectClassName
          )}>
            <InFiltersDrawer.Provider value>{children}</InFiltersDrawer.Provider>
            {results && (
              <div className="mt-2 pt-6 border-t border-border flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('common.results') || 'Results'}</h3>
                <div className="-mx-4 px-4 overflow-x-auto">
                  {results}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
  )
  const showDrawer = !container || alwaysModal || results || getDrawerSections(sections).some(section => !isValidElement(section) || section.type !== FilterSeparator)
  return search || actions || controls || tabs || mobileTabs.length > 0
    ? <ListToolbar search={search?.props.children} tabs={(tabs || mobileTabs.length > 0) && <>{tabs}{mobileTabs}</>}
        actions={actions} controls={(showDrawer || controls) && <>{showDrawer && drawer}{controls}</>} />
    : <div className="flex shrink-0">{drawer}</div>
}
