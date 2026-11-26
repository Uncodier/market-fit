"use client"

import { useEffect, useState, type MouseEvent } from "react"
import { toast } from "sonner"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { PenTool, Plus } from "@/app/components/ui/icons"
import { Pagination } from "@/app/components/ui/pagination"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { SearchInput } from "@/app/components/ui/search-input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { ViewSelector, type ViewType } from "@/app/components/view-selector"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { getCopywriting, saveCopywriting } from "./actions"
import { CopywritingDialog } from "./CopywritingDialog"
import { CopywritingResults } from "./CopywritingResults"
import { COPY_TABS, type CopyFields, type CopyTab, type CopywritingItem } from "./copywriting-model"

const PAGE_SIZE = 12
type ListState = { status: "loading" | "error" } | { status: "ready"; items: CopywritingItem[]; canWrite: boolean }
type DialogState = { mode: "create" } | { mode: "view" | "edit"; id: string }

export default function CopywritingPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  if (!currentSite || currentSite.id.startsWith("demo-")) {
    return <p className="px-4 py-8 text-sm text-muted-foreground lg:px-8">{t("copywriting.screen.siteRequired")}</p>
  }
  return <CopywritingWorkspace key={currentSite.id} siteId={currentSite.id} />
}

function CopywritingWorkspace({ siteId }: { siteId: string }) {
  const { t, locale } = useLocalization()
  const isMobile = useIsMobile()
  const text = (key: string) => t(`copywriting.screen.${key}`)
  const [state, setState] = useState<ListState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useState<ViewType>("kanban")
  const [tab, setTab] = useState<CopyTab>("all")
  const [tabsWidth, setTabsWidth] = useState<number>()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let active = true
    getCopywriting(siteId).then(result => {
      if (active) setState({ status: "ready", ...result })
    }).catch(() => {
      if (active) setState({ status: "error" })
    })
    return () => { active = false }
  }, [attempt, siteId])

  const items = state.status === "ready" ? state.items : []
  const canWrite = state.status === "ready" && state.canWrite
  const query = search.trim().toLocaleLowerCase(locale)
  const matchingSearch = items.filter(item => !query || [item.title, item.content].some(value => value.toLocaleLowerCase(locale).includes(query)))
  const results = matchingSearch.filter(item => tab === "all" || item.copy_type === tab)
  const totalPages = Math.ceil(results.length / PAGE_SIZE)
  const currentPage = Math.min(page, Math.max(1, totalPages))
  const selected = dialog && dialog.mode !== "create" ? items.find(item => item.id === dialog.id) : undefined
  const filterTabs = COPY_TABS.map(type => ({
    value: type,
    label: <span className="inline-flex items-center gap-1.5">
      {text(`tabs.${type}`)}
      {state.status === "ready" && <Badge variant="secondary" className="px-1.5">
        {type === "all" ? matchingSearch.length : matchingSearch.filter(item => item.copy_type === type).length}
      </Badge>}
    </span>,
  }))
  const changeTab = (value: string) => { setTab(value as CopyTab); setPage(1) }

  const openNew = (event: MouseEvent<HTMLButtonElement>) => {
    setReturnFocus(event.currentTarget)
    setDialog({ mode: "create" })
  }
  const save = async (fields: CopyFields) => {
    const saved = await saveCopywriting(siteId, selected?.id ?? null, fields)
    setState(previous => previous.status === "ready" ? {
      ...previous,
      items: selected ? previous.items.map(item => item.id === saved.id ? saved : item) : [saved, ...previous.items],
    } : previous)
    if (!selected) { setTab("all"); setSearch(""); setPage(1) }
    setDialog({ mode: "view", id: saved.id })
    toast.success(text("saved"))
  }

  return (
    <>
      <TopBarPrimaryActions>
        {canWrite && <Button size="sm" onClick={openNew} aria-label={text("new")} title={text("new")} className="gap-2 max-sm:!w-9 max-sm:!px-0">
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{text("new")}</span>
        </Button>}
      </TopBarPrimaryActions>

      <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
        <StickyHeader className="!sticky top-[var(--topbar-height,64px)]">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-2 py-3 lg:flex-nowrap">
            <div className="min-w-0 basis-full lg:basis-auto" style={{ width: tabsWidth ? Math.ceil(tabsWidth) : undefined }}>
              <ResponsiveTabsList
                tabs={filterTabs}
                activeTab={tab}
                onTabChange={changeTab}
                onPreferredWidthChange={setTabsWidth}
                aria-label={text("type")}
                overflowLabel={text("moreTypes")}
                className="h-auto rounded-full p-0.5"
                triggerClassName="px-1 py-1 text-xs"
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center lg:flex-none">
              <SearchInput
                type="search"
                placeholder={text("search")}
                aria-label={text("search")}
                clearLabel={text("clearSearch")}
                value={search}
                onSearch={value => { setSearch(value); setPage(1) }}
                alwaysExpanded={isMobile}
                className="h-10 w-full md:h-9 [&::-webkit-search-cancel-button]:hidden"
                expandedHeightClassName="h-10 md:h-9"
                containerClassName="min-w-0 flex-1 lg:w-64 lg:flex-none"
              />
            </div>
            <div className="ml-auto shrink-0">
              <ViewSelector currentView={view} onViewChange={setView} labels={{ table: text("table"), kanban: text("grid") }} />
            </div>
          </div>
        </StickyHeader>

        <TabsContent key={tab} value={tab} className="mt-0 px-4 pb-24 pt-6 lg:px-8">
          {state.status === "error" ? (
            <div className="space-y-4 py-12 text-center">
              <p role="alert" className="text-sm text-destructive">{text("loadError")}</p>
              <Button variant="outline" onClick={() => { setState({ status: "loading" }); setAttempt(value => value + 1) }}>{text("retry")}</Button>
            </div>
          ) : state.status === "ready" && !results.length ? (
            <EmptyCard
              variant="simple"
              icon={<PenTool aria-hidden />}
              title={text("empty")}
              description={text(query || tab !== "all" ? "emptyFiltered" : "emptyLibrary")}
            />
          ) : (
            <>
              <CopywritingResults items={results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)} table={view === "table"} loading={state.status === "loading"} canWrite={canWrite} onOpen={(item, edit) => {
                setReturnFocus(document.activeElement instanceof HTMLElement ? document.activeElement : null)
                setDialog({ mode: edit ? "edit" : "view", id: item.id })
              }} />
              <Pagination className="mt-6 justify-center" currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </TabsContent>
      </Tabs>

      {dialog && (dialog.mode === "create" || selected) && <CopywritingDialog
        key={`${selected?.id ?? "new"}:${dialog.mode}`}
        item={selected}
        tab={tab}
        editing={dialog.mode !== "view"}
        canWrite={canWrite}
        onEdit={() => { if (selected) setDialog({ id: selected.id, mode: dialog.mode === "edit" ? "view" : "edit" }) }}
        onClose={() => setDialog(null)}
        onCloseAutoFocus={event => {
          event.preventDefault()
          if (!document.querySelector('[role="dialog"]')) returnFocus?.focus()
        }}
        onSave={save}
      />}
    </>
  )
}