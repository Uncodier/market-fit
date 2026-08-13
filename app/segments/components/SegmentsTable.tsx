"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Switch } from "@/app/components/ui/switch"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Copy, Globe, MoreHorizontal, Users } from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/app/lib/formatters"
import { Segment } from "@/app/types/segments"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function formatSize(size: string | null) {
  if (!size) return null
  const numeric = Number(String(size).replace(/,/g, ""))
  if (!Number.isNaN(numeric) && String(size).replace(/,/g, "").trim() !== "") {
    return numeric.toLocaleString("en-US")
  }
  return size
}

interface SegmentsTableProps {
  segments: Segment[]
  activeById: Record<string, boolean>
  searchQuery?: string
  onSegmentClick: (segment: Segment) => void
  onToggleStatus: (id: string) => void
  onCopyUrl: (id: string) => void
  onConfigureUrl: (id: string) => void
  copiedUrlId?: string | null
}

export function SegmentsTable({
  segments,
  activeById,
  searchQuery,
  onSegmentClick,
  onToggleStatus,
  onCopyUrl,
  onConfigureUrl,
  copiedUrlId,
}: SegmentsTableProps) {
  const { t } = useLocalization()

  if (segments.length === 0) {
    return (
      <EmptyCard
        icon={<Users className="h-8 w-8 text-muted-foreground" />}
        title={
          searchQuery
            ? (t("segments.table.noResults") || "No matching segments")
            : (t("segments.empty.title") || "No segments yet")
        }
        description={
          searchQuery
            ? (t("segments.table.noResultsDesc") || "Try a different search term.")
            : (t("segments.empty.description") || "Segments help you organize and target specific audience groups.")
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[820px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[38%]">{t("segments.table.segment") || "Segment"}</DocumentListHead>
            <DocumentListHead className="w-[16%]">{t("segments.labels.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("segments.labels.language") || "Language"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("segments.labels.size") || "Size"}</DocumentListHead>
            <DocumentListHead className="w-[14%]" align="right">{t("segments.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment) => {
            const isActive = Boolean(activeById[segment.id])
            const statusLabel = isActive
              ? (t("segments.tabs.active") || "Active")
              : (t("segments.tabs.draft") || "Draft")
            const sizeLabel = formatSize(segment.size)
            const value = segment.estimated_value

            return (
              <DocumentListRow
                key={segment.id}
                onClick={() => onSegmentClick(segment)}
                accent={isActive ? "none" : "due"}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={segment.name}
                    secondary={segment.description || null}
                    meta={segment.audience || null}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <StatusDot status={isActive ? "active" : "draft"} label={statusLabel} />
                    <Switch
                      checked={isActive}
                      onCheckedChange={() => onToggleStatus(segment.id)}
                      className="scale-90"
                    />
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {segment.language ? segment.language.toUpperCase() : "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                      {sizeLabel || "—"}
                    </span>
                    {typeof value === "number" && value > 0 ? (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatCurrency(value)}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("segments.table.actions") || "Actions"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onCopyUrl(segment.id)} disabled={!segment.url}>
                        <Copy className="h-4 w-4 mr-2" />
                        {copiedUrlId === segment.id
                          ? (t("segments.table.copied") || "Copied")
                          : (t("segments.table.copyUrl") || "Copy URL")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onConfigureUrl(segment.id)}>
                        <Globe className="h-4 w-4 mr-2" />
                        {t("segments.dialog.configureUrl") || "Configure URL"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{segments.length}</span>
          {" "}
          {t("segments.table.segments") || "segments"}
        </p>
      </div>
    </div>
  )
}

export function SegmentsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 5 }).map((_, index) => (
              <DocumentListHead key={index} align={index >= 3 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index >= 3 && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-10" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
