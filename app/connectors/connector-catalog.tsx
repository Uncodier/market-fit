"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocalization } from "@/app/context/LocalizationContext"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SearchInput } from "@/app/components/ui/search-input"
import { Button } from "@/app/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"
import { useAutoCollapseSidebar } from "@/app/hooks/use-auto-collapse-sidebar"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { ConnectorCard } from "./connector-card"
import { ConnectorPagination } from "./connector-pagination"
import { ConnectorProviderMode } from "./connector-provider-mode"
import { ConnectorDomainsSheet, ConnectorDomainsSidebar } from "./connector-domains"
import { ConnectorEmpty, ConnectorError, ConnectorSiteScope } from "./connector-feedback"
import { ConnectorCatalogueSkeleton, connectorCatalogueBodyClassName, connectorGridClassName } from "./connector-skeletons"
import { useConnectorResource } from "./use-connector-resource"
import { catalogSchema, connectorDomainCountsSchema } from "./types"
import { catalogFilters, catalogQuery } from "./catalog-state"
import { canRecoverLocalAccounts } from "./connector-request"
import { LocalAccountRecovery } from "./local-account-recovery"

export default function ConnectorCatalog() {
  return <ConnectorSiteScope loading={<ConnectorCatalogueSkeleton fullPage />}>{(siteId, scope) => <CatalogContent key={scope} siteId={siteId} />}</ConnectorSiteScope>
}

export function CatalogContent({ siteId }: { siteId: string }) {
  const { t } = useLocalization()
  const router = useRouter()
  const params = useSearchParams()
  const filters = catalogFilters(params)
  const isMobile = useIsMobile()
  const [sidebarCollapsed, setSidebarCollapsed] = useAutoCollapseSidebar()
  const [draft, setDraft] = useState({ query: filters.q, value: filters.q })
  const search = draft.query === filters.q ? draft.value : filters.q
  const query = catalogQuery(filters)
  query.set("site_id", siteId)
  if (!filters.cursor) query.set("page", String(filters.page))
  const { data, error, previousData, reload } = useConnectorResource(`/api/connectors/catalog?${query}`, catalogSchema)
  const update = (change: Partial<typeof filters>) => {
    router.push(`/connectors?${catalogQuery({ ...filters, cursor: "", page: 1, ...change })}`, { scroll: false })
  }
  const selectDomain = (category: string) => {
    const next = new URLSearchParams(params.toString())
    if (category) next.set("category", category)
    else next.delete("category")
    next.delete("cursor")
    next.delete("page")
    const search = next.toString()
    window.history.pushState(null, "", search ? `/connectors?${search}` : "/connectors")
  }
  // Keep workspace-scoped metadata visible while the requested results load.
  const metadata = data ?? previousData
  const domainLabels = Object.fromEntries((metadata?.domains || []).map(domain => [domain.id, domain.label]))
  const showDomains = !error && metadata?.configured !== false
  const countsQuery = new URLSearchParams({ site_id: siteId, tab: filters.tab })
  if (filters.q) countsQuery.set("q", filters.q)
  const { data: domainCounts } = useConnectorResource(showDomains && metadata?.configured
    ? `/api/connectors/domain-counts?${countsQuery}` : null, connectorDomainCountsSchema)
  const domainProps = { domains: metadata?.domains ?? [], domainCounts, loading: !metadata, selected: filters.category, onSelect: selectDomain }

  return <div className="flex min-w-0 flex-1">
    {showDomains && !isMobile && !sidebarCollapsed && <ConnectorDomainsSidebar {...domainProps} />}
    <div className="min-w-0 flex-1">
      <StickyHeader>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 py-3 sm:gap-3">
          {showDomains && (isMobile ? <ConnectorDomainsSheet {...domainProps} /> :
            <SidebarToggle className="hidden md:flex" isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              ariaLabelShow={t("connectors.showDomains")} ariaLabelHide={t("connectors.hideDomains")} />)}
          <form role="search" aria-label={t("connectors.search")} className="min-w-0" onSubmit={event => { event.preventDefault(); update({ q: search.trim().slice(0, 200) }) }}>
            <SearchInput aria-label={t("connectors.search")} placeholder={t("connectors.search")} maxLength={200} value={search}
              containerClassName="w-64 max-w-full"
              onChange={event => {
                setDraft({ query: filters.q, value: event.target.value })
                if (!event.target.value) update({ q: "" })
              }} />
          </form>
          <Tabs value={filters.tab} onValueChange={tab => update({ tab: tab === "connected" ? "connected" : "all" })}>
            <TabsList className="h-8 rounded-full bg-muted/30 p-0.5">
              <TabsTrigger value="all" className="rounded-full px-4 text-xs">{t("connectors.all")}</TabsTrigger>
              <TabsTrigger value="connected" className="rounded-full px-4 text-xs">{t("connectors.connected")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </StickyHeader>
      <div className={`${connectorCatalogueBodyClassName} space-y-6`}>
        {error ? <ConnectorError error={error} retry={reload} /> : !data ? <ConnectorCatalogueSkeleton /> : !data.configured ?
          <ConnectorEmpty title={t("connectors.setupTitle")} description={t("connectors.setupHelp")} action={data.can_manage && <Button asChild variant="outline"><Link href="/integrations">{t("connectors.integrations")}</Link></Button>} /> :
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">{data.total === null ? t("connectors.pageCount", { count: data.items.length }) : t("connectors.resultCount", { count: data.total })}</p>
            {data.items.length === 0 ? <ConnectorEmpty title={t(filters.tab === "connected" ? "connectors.noConnections" : "connectors.noResults")} description={t("connectors.noResultsHelp")} /> :
              <div className={connectorGridClassName}>{data.items.map(toolkit => <ConnectorCard key={toolkit.slug} toolkit={toolkit} domains={domainLabels} siteId={siteId} orderedToolkits={data.items} />)}</div>}
            {data.total === null && filters.category && <p className="text-xs text-muted-foreground">{t("connectors.filteredPages")}</p>}
            <ConnectorPagination page={data.current_page ?? filters.page} totalPages={data.total_pages ?? null}
              hasNext={!!data.next_cursor} onPageChange={page => update({ page })} />
          </div>}
        {(canRecoverLocalAccounts(error) || data?.configured === false) && <LocalAccountRecovery siteId={siteId} />}
        <footer className="space-y-1 text-sm text-muted-foreground">
          <p>{t("connectors.description")}</p>
          {metadata?.configured && <ConnectorProviderMode source={metadata.credential_source} />}
        </footer>
      </div>
    </div>
  </div>
}