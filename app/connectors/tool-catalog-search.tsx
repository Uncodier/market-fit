"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Check, ChevronLeft, ChevronRight, Search } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { ConnectorError } from "./connector-feedback"
import { useToolCatalog } from "./use-tool-catalog"
import { ToolActionSelect } from "./tool-action-select"
import type { ToolAction } from "./tool-action-types"

type SearchProps = { siteId: string; slug: string; selected: string[]; onSelect: (id: string) => void }

export function ToolCatalogSearch(props: SearchProps) {
  const { t } = useLocalization()
  const [input, setInput] = useState("")
  const [search, setSearch] = useState("")
  const [action, setAction] = useState<ToolAction>("all")
  const query = input.trim()
  useEffect(() => {
    if (query === search) return
    const timer = setTimeout(() => setSearch(query), 250)
    return () => clearTimeout(timer)
  }, [query, search])
  return <>
    <div className="shrink-0 space-y-2 border-b p-3">
      <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden={true} />
        <Input type="search" className="min-w-0 flex-1 appearance-none border-0 bg-transparent px-0 focus-visible:ring-0 [&::-webkit-search-decoration]:appearance-none"
          aria-label={t("connectors.searchTools")} placeholder={t("connectors.searchTools")} maxLength={200}
          value={input} onChange={event => setInput(event.target.value)} />
      </label>
      <ToolActionSelect value={action} onChange={setAction} />
    </div>
    {search === query ? <ToolResults key={`${action}:${search}`} {...props} search={search} action={action} /> : <LoadingTools />}
  </>
}

function LoadingTools() {
  const { t } = useLocalization()
  return <p role="status" className="p-2 text-sm text-muted-foreground">{t("connectors.loadingTools")}</p>
}

function ToolResults({ siteId, slug, selected, onSelect, search, action }: SearchProps & { search: string; action: ToolAction }) {
  const { t } = useLocalization()
  const [page, setPage] = useState(1)
  const { data, error, reload, currentPage, totalPages } = useToolCatalog(siteId, slug, page, search, action)
  if (error) return <ConnectorError error={error} retry={reload} />
  if (!data) return <LoadingTools />
  const hasNext = totalPages === null ? !!data.next_cursor : currentPage < totalPages
  return <>
    <ul aria-label={t("connectors.tools")} className="min-h-0 max-h-80 overflow-y-auto overscroll-contain p-1.5">
      {data.items.map(tool => {
        const added = selected.includes(tool.slug)
        return <li key={tool.slug} className="border-b last:border-0">
          <button type="button" disabled={added} onClick={() => onSelect(tool.slug)}
            className="flex w-full min-w-0 flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60">
            <span className="break-words text-sm font-medium">{tool.name}</span>
            <code className="block w-full truncate text-xs text-muted-foreground" title={tool.slug}>{tool.slug}</code>
            <span className="line-clamp-2 break-words text-xs text-muted-foreground" title={tool.description}>{tool.description}</span>
            <span className="flex flex-wrap items-center gap-2 text-xs">
              {(tool.action_types?.length ? tool.action_types : ["unclassified"]).map(type =>
                <span key={type} className="rounded-full bg-muted px-2 py-0.5">{t(`connectors.toolAction.${type}`)}</span>)}
              <span className="rounded-full bg-muted px-2 py-0.5">{t(tool.reviewed ? "connectors.toolReviewed" : "connectors.catalogOnlyStatus")}</span>
              {added && <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />{t("connectors.toolAlreadyAdded")}</span>}
            </span>
          </button>
        </li>
      })}
      {!data.items.length && <li><p role="status" className="p-2 text-sm text-muted-foreground">{t(search || action !== "all" ? "connectors.noToolMatches" : "connectors.noTools")}</p></li>}
    </ul>
    {(currentPage > 1 || hasNext) && <nav aria-label={t("connectors.pagination")} className="flex shrink-0 items-center justify-between border-t px-3 py-1">
      <Button type="button" variant="ghost" size="icon" aria-label={t("commerce.pagination.previous")} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span className="text-xs tabular-nums text-muted-foreground" aria-current="page">{currentPage}{totalPages !== null && ` / ${totalPages}`}</span>
      <Button type="button" variant="ghost" size="icon" aria-label={t("commerce.pagination.next")} disabled={!hasNext} onClick={() => setPage(currentPage + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </nav>}
  </>
}