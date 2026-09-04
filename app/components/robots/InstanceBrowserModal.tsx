"use client"

import React, { useMemo, useState } from "react"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { SearchInput } from "@/app/components/ui/search-input"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Check, ChevronDown, ClipboardList, FileText, LayoutGrid, ListOrdered, NetworkTree, Workflow } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { InstanceBrowserTable } from "./instance-browser-table"
import { useInstanceBrowserData } from "./use-instance-browser-data"
import {
  countInstancesByTab,
  filterAndSortInstances,
  type InstanceFilterTab,
  type InstanceSortBy,
  type RobotInstance,
} from "./instance-browser-model"

interface InstanceBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  instances: RobotInstance[]
  onSelect: (id: string) => void
  onDelete?: (instance: { id: string; name: string }) => void
  deletingInstanceIds?: Set<string>
}

const TABS: { value: InstanceFilterTab; icon: React.ComponentType<{ className?: string; size?: number }> }[] = [
  { value: "all", icon: LayoutGrid },
  { value: "nodes", icon: NetworkTree },
  { value: "workflows", icon: Workflow },
  { value: "files", icon: FileText },
  { value: "requirements", icon: ClipboardList },
]

const SORT_OPTIONS: InstanceSortBy[] = ["newest", "oldest", "name_asc", "name_desc", "status"]

export function InstanceBrowserModal({
  isOpen,
  onClose,
  instances,
  onSelect,
  onDelete,
  deletingInstanceIds,
}: InstanceBrowserModalProps) {
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<InstanceFilterTab>("all")
  const [sortBy, setSortBy] = useState<InstanceSortBy>("newest")
  const { instanceMessages, instanceStats, isLoadingStats, isLoadingMessages } = useInstanceBrowserData(isOpen, instances)

  const tabCounts = useMemo(
    () => countInstancesByTab(instances, instanceStats),
    [instances, instanceStats]
  )

  const filteredInstances = useMemo(
    () => filterAndSortInstances(instances, searchQuery, activeTab, sortBy, instanceStats),
    [instances, searchQuery, activeTab, sortBy, instanceStats]
  )

  const tabLabel = (tab: InstanceFilterTab) => {
    if (tab === "all") return t("robots.browser.tabs.all") || "All"
    if (tab === "nodes") return t("robots.browser.tabs.nodes") || "Nodes"
    if (tab === "workflows") return t("robots.browser.tabs.workflows") || "Workflows"
    if (tab === "files") return t("robots.browser.tabs.files") || "Files"
    return t("robots.browser.tabs.requirements") || "Requirements"
  }

  const sortLabel = (value: InstanceSortBy) => {
    if (value === "newest") return t("robots.browser.sort.newest") || "Newest"
    if (value === "oldest") return t("robots.browser.sort.oldest") || "Oldest"
    if (value === "name_asc") return t("robots.browser.sort.nameAsc") || "Name (A-Z)"
    if (value === "name_desc") return t("robots.browser.sort.nameDesc") || "Name (Z-A)"
    return t("robots.browser.sort.status") || "Active first"
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="xl" flush className="h-[80vh] sm:max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{t("robots.browser.title") || "All Makinas"}</DialogTitle>
          <DialogDescription>
            {filteredInstances.length === instances.length
              ? `${instances.length} ${t("robots.browser.instances") || "instances"}`
              : `${filteredInstances.length} ${t("robots.browser.of") || "of"} ${instances.length} ${t("robots.browser.instances") || "instances"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-3 border-b px-6 py-3">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InstanceFilterTab)} className="min-w-0">
            <TabsList className="h-8 w-full p-0.5 bg-muted/30 rounded-full flex flex-row overflow-x-auto justify-start items-center">
              {TABS.map(({ value, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="justify-center rounded-full text-xs py-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm whitespace-nowrap"
                >
                  <Icon className="h-3 w-3 shrink-0 md:hidden" size={13} />
                  <span>{tabLabel(value)}</span>
                  <span className="tabular-nums text-muted-foreground/70">{tabCounts[value]}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
              <SearchInput
                value={searchQuery}
                onSearch={setSearchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("robots.browser.search") || "Search instances..."}
              className="w-full"
              containerClassName="min-w-0 flex-1"
                alwaysExpanded={true}
              />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-9 gap-2 rounded-full px-4 shrink-0"
                  title={t("robots.browser.sort.by") || "Sort by"}
                >
                  <ListOrdered className="h-4 w-4" />
                  <span className="hidden sm:inline font-normal">{sortLabel(sortBy)}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option} className="cursor-pointer" onClick={() => setSortBy(option)}>
                    <Check className={cn("mr-2 h-4 w-4", sortBy === option ? "opacity-100" : "opacity-0")} />
                    {sortLabel(option)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
        </div>

        <DialogBody className="p-4">
          <InstanceBrowserTable
            instances={filteredInstances}
            instanceStats={instanceStats}
            instanceMessages={instanceMessages}
            isLoadingStats={isLoadingStats}
            isLoadingMessages={isLoadingMessages}
            onSelect={(id) => {
              onSelect(id)
              onClose()
            }}
            onDelete={onDelete}
            deletingInstanceIds={deletingInstanceIds}
            emptyTitle={t("robots.browser.empty") || "No instances found"}
            emptyDescription={t("robots.browser.emptyDesc") || "Try a different search or filter."}
            labels={{
              name: t("robots.browser.table.name") || "Name",
              status: t("robots.browser.table.status") || "Status",
              nodes: t("robots.browser.table.nodes") || "Nodes",
              workflows: t("robots.browser.table.workflows") || "Workflows",
              files: t("robots.browser.table.files") || "Files",
              requirements: t("robots.browser.table.requirements") || "Requirements",
              updated: t("robots.browser.table.updated") || "Updated",
              delete: t("robots.browser.delete") || "Delete instance",
              deleting: t("robots.browser.deleting") || "Deleting...",
            }}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
