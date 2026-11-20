"use client"

import { useState } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorPagination } from "./connector-pagination"
import { Badge } from "@/app/components/ui/badge"
import { useToolCatalog } from "./use-tool-catalog"
import { ConnectorEmpty, ConnectorError } from "./connector-feedback"
import { ConnectorToolsSkeleton } from "./connector-skeletons"

export function ConnectorTools({ siteId, slug }: { siteId: string; slug: string }) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const { data, error, reload, currentPage, totalPages } = useToolCatalog(siteId, slug, page)
  return <section className="space-y-4" aria-label={t("connectors.tools")}>
    <h2 className="text-xl font-semibold">{t("connectors.tools")}</h2>
    <p className="text-sm text-muted-foreground">{t("connectors.toolsHelp")}</p>
    {error ? <ConnectorError error={error} retry={reload} /> : !data ? <ConnectorToolsSkeleton /> : <>
      <p className="text-sm text-muted-foreground" aria-live="polite">{t(data.total === null ? "connectors.toolsPageCount" : "connectors.toolsTotal", { count: data.total ?? data.items.length })}</p>
      {!data.items.length ? <ConnectorEmpty title={t("connectors.noTools")} description={t("connectors.toolsHelp")} /> :
        <ul className="space-y-3">{data.items.map(tool => <li key={tool.slug} className="space-y-2 rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{tool.name}</h3>
            <Badge variant="outline">{t(tool.reviewed ? "connectors.toolReviewed" : "connectors.toolCatalogOnly")}</Badge></div>
          <code className="block break-all text-xs text-muted-foreground">{tool.slug}</code>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{tool.description}</p>
        </li>)}</ul>}
      <ConnectorPagination page={currentPage} totalPages={totalPages}
        hasNext={!!data.next_cursor} onPageChange={setPage} />
    </>}
  </section>
}