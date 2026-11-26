"use client"

import { DocumentListHead, DocumentListRow, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, SkeletonCard } from "@/app/components/ui/cards"
import { FileText, Pencil } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { CopywritingItem } from "./copywriting-model"
import { WHATSAPP_TEMPLATE_TAG } from "./template-model"

const cardGrid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
const cardShell = "min-w-0 rounded-xl border-border/70 shadow-none"
const placeholderRows = Array.from({ length: 6 }, (_, index) => index)

function CopyIcon() {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground" aria-hidden>
    <FileText className="h-4 w-4" />
  </span>
}

type Props = {
  items: CopywritingItem[]
  table: boolean
  loading: boolean
  canWrite: boolean
  onOpen: (item: CopywritingItem, edit?: boolean) => void
}

export function CopywritingResults({ items, table, loading, canWrite, onOpen }: Props) {
  const { t } = useLocalization()
  const text = (key: string) => t(`copywriting.screen.${key}`)
  const typeLabel = (item: CopywritingItem) => text(item.tags?.includes(WHATSAPP_TEMPLATE_TAG) ? "template.whatsapp" : `types.${item.copy_type}`)
  const status = (item: CopywritingItem) => {
    const key = item.status ?? "draft"
    return <StatusDot status={key} label={text(`statuses.${key}`)} />
  }
  const title = (item: CopywritingItem) => (
    <button type="button" onClick={event => { event.stopPropagation(); onOpen(item) }} className="block max-w-full truncate text-left leading-tight hover:underline focus-visible:underline">
      {item.title}
    </button>
  )
  const edit = (item: CopywritingItem) => (
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label={`${text("edit")}: ${item.title}`} onClick={event => { event.stopPropagation(); onOpen(item, true) }}>
      <Pencil className="h-4 w-4" aria-hidden />
    </Button>
  )

  if (table) return (
    <div className={documentListShellClassName("min-w-0")}>
      {loading && <span className="sr-only" role="status">{text("loading")}</span>}
      <Table aria-label={text("table")} aria-busy={loading}>
        <TableHeader className="bg-card"><TableRow className="hover:bg-transparent">
          <DocumentListHead>{text("title")}</DocumentListHead>
          <DocumentListHead className="hidden w-[28%] sm:table-cell">{text("type")}</DocumentListHead>
          <DocumentListHead className="w-28 px-2 sm:w-36 sm:px-4">{text("status")}</DocumentListHead>
          {canWrite && <DocumentListHead className="w-12 sm:w-16" align="right"><span className="sr-only">{text("edit")}</span></DocumentListHead>}
        </TableRow></TableHeader>
        <TableBody>{loading ? placeholderRows.map(index => (
          <TableRow key={index} aria-hidden className="border-border/50 hover:bg-transparent">
            <TableCell className="px-3 py-3.5 sm:px-4">
              <div className="flex items-center gap-3"><Skeleton className="hidden h-9 w-9 shrink-0 sm:block" /><Skeleton className="h-4 w-1/2" /></div>
            </TableCell>
            <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-2/3" /></TableCell>
            <TableCell className="px-2 sm:px-4"><Skeleton className="h-4 w-16" /></TableCell>
            {canWrite && <TableCell />}
          </TableRow>
        )) : items.map(item => (
          <DocumentListRow key={item.id} onClick={() => onOpen(item)} className="focus-within:bg-muted/40">
            <TableCell className="px-3 py-3.5 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="hidden sm:block"><CopyIcon /></div>
                <div className="min-w-0 space-y-0.5">
                  <div className="font-medium">{title(item)}</div>
                  <p className="truncate text-xs text-muted-foreground">{item.content}</p>
                  <p className="truncate text-xs text-muted-foreground sm:hidden">{typeLabel(item)}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden truncate py-3.5 text-sm text-muted-foreground sm:table-cell">{typeLabel(item)}</TableCell>
            <TableCell className="px-2 py-3.5 sm:px-4">{status(item)}</TableCell>
            {canWrite && <TableCell className="px-2 py-3.5 text-right sm:pr-4">{edit(item)}</TableCell>}
          </DocumentListRow>
        ))}</TableBody>
      </Table>
    </div>
  )

  if (loading) return (
    <div className={cardGrid} role="status" aria-label={text("loading")}>
      {placeholderRows.map(index => <SkeletonCard key={index} className={`${cardShell} min-h-44`} headerClassName="p-4" contentClassName="px-4" contentLines={3} />)}
    </div>
  )

  return <div className={cardGrid}>{items.map(item => (
    <Card key={item.id} className={`${cardShell} flex flex-col transition-colors hover:border-border focus-within:border-border`}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-3">
        <CopyIcon />
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-sm font-semibold tracking-normal">{title(item)}</CardTitle>
          <p className="truncate text-xs text-muted-foreground">{typeLabel(item)}</p>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-4 pb-4">
        <p className="line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">{item.content}</p>
      </CardContent>
      <CardFooter className="min-h-12 justify-between gap-2 border-t border-border/50 px-4 py-2">
        {status(item)}
        {canWrite && edit(item)}
      </CardFooter>
    </Card>
  ))}</div>
}