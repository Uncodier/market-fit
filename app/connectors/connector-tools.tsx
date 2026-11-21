"use client"

import { useMemo, useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorPagination } from "./connector-pagination"
import { Badge } from "@/app/components/ui/badge"
import { QuickNav } from "@/app/components/ui/quick-nav"
import { useToolCatalog, type CatalogTool } from "./use-tool-catalog"
import { ConnectorEmpty, ConnectorError } from "./connector-feedback"
import { ConnectorToolsSkeleton } from "./connector-skeletons"
import { primaryToolAction, toolActionTypes } from "./tool-action-types"

const actionGroups = [...toolActionTypes, "unclassified"] as const

export function ConnectorTools({ siteId, slug, search = "" }: { siteId: string; slug: string; search?: string }) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const { data, error, reload, currentPage, totalPages } = useToolCatalog(siteId, slug, page, search)
  const groups = useMemo(() => {
    const grouped = new Map<typeof actionGroups[number], CatalogTool[]>()
    for (const tool of data?.items ?? []) {
      const group = primaryToolAction(tool.action_types)
      const items = grouped.get(group) ?? []
      items.push(tool)
      grouped.set(group, items)
    }
    return actionGroups.flatMap(group => {
      const items = grouped.get(group)
      return items ? [{ id: `connector-tools-${group}`, title: t(`connectors.toolAction.${group}`), items }] : []
    })
  }, [data, t])
  return (
    <div className="flex gap-8">
      <section className="min-w-0 flex-1 space-y-4" aria-label={t("connectors.tools")}>
        <h2 className="text-xl font-semibold">{t("connectors.tools")}</h2>
        <p className="text-sm text-muted-foreground">{t("connectors.toolsHelp")}</p>
        {error ? <ConnectorError error={error} retry={reload} /> : !data ? <ConnectorToolsSkeleton /> : <>
          <p className="text-sm text-muted-foreground" aria-live="polite">{t(data.total === null ? "connectors.toolsPageCount" : search ? "connectors.toolsMatching" : "connectors.toolsTotal", { count: data.total ?? data.items.length })}</p>
          {!groups.length && <ConnectorEmpty title={t(search ? "connectors.noToolMatches" : "connectors.noTools")} description={t("connectors.toolsHelp")} />}
          {groups.map(group => <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`}
            className="scroll-mt-[calc(var(--topbar-height,64px)+76px)] space-y-3">
            <h3 id={`${group.id}-title`} className="font-semibold">{group.title}</h3>
            <ul className="space-y-3">{group.items.map(tool => <ToolCard key={tool.slug} tool={tool} />)}</ul>
          </section>)}
          <ConnectorPagination page={currentPage} totalPages={totalPages}
            hasNext={!!data.next_cursor} onPageChange={setPage} />
        </>}
      </section>
      <QuickNav sections={groups} />
    </div>
  )
}

function ToolCard({ tool }: { tool: CatalogTool }) {
  const { t } = useLocalization()
  return <li className="space-y-2 rounded-lg border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-medium">{tool.name}</h4>
      <Badge variant="outline">{t(tool.reviewed ? "connectors.toolReviewed" : "connectors.toolCatalogOnly")}</Badge></div>
    <code className="block break-all text-xs text-muted-foreground">{tool.slug}</code>
    {tool.action_types && tool.action_types.length > 1 && <p className="text-xs text-muted-foreground">
      {tool.action_types.map(action => t(`connectors.toolAction.${action}`)).join(" · ")}
    </p>}
    <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{tool.description}</p>
  </li>
}