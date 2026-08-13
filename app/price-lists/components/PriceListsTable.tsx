"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { Edit, Eye, MoreHorizontal, Plus, Tag } from "@/app/components/ui/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PriceList } from "@/app/types"
import { cn } from "@/lib/utils"
import { normalizePriceListChannels } from "../price-list-channels"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

const CHANNEL_LABELS: Record<string, { key: string; fallback: string }> = {
  pos: { key: "priceLists.channels.pos", fallback: "POS" },
  shop: { key: "priceLists.channels.shop", fallback: "Shop" },
  marketplace: { key: "priceLists.channels.marketplace", fallback: "Marketplace" },
}

interface PriceListsTableProps {
  lists: PriceList[]
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onOpen: (id: string) => void
  onEdit: (list: PriceList) => void
  onCreate?: () => void
}

export function PriceListsTable({
  lists,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onOpen,
  onEdit,
  onCreate,
}: PriceListsTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize

  if (lists.length === 0) {
    return (
      <EmptyCard
        icon={<Tag className="h-6 w-6 text-muted-foreground" />}
        title={t("priceLists.empty.title") || "No price lists"}
        description={t("priceLists.empty.description") || "Create a price list to manage different pricing tiers."}
        actionButton={
          onCreate ? (
            <Button onClick={onCreate} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {t("priceLists.addList") || "Create List"}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[32%]">{t("priceLists.name") || "Name"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("priceLists.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[20%]">{t("priceLists.channels.title") || "Apply on"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("priceLists.code") || "Code"}</DocumentListHead>
            <DocumentListHead className="w-[12%]" align="right">{t("priceLists.currency") || "Currency"}</DocumentListHead>
            <DocumentListHead className="w-[10%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lists.map((list) => {
            const channels = normalizePriceListChannels(list.channels)
            const channelLabel = channels
              .map((channel) => {
                const meta = CHANNEL_LABELS[channel]
                return t(meta.key) || meta.fallback
              })
              .join(" · ")
            const status = list.is_active ? "active" : "inactive"
            const statusLabel = list.is_active
              ? (t("priceLists.active") || "Active")
              : (t("priceLists.inactive") || "Inactive")

            return (
              <DocumentListRow
                key={list.id}
                onClick={() => onOpen(list.id)}
                accent={list.is_active ? "none" : "cancelled"}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={list.name}
                    secondary={list.code || null}
                    meta={list.is_default ? (t("priceLists.default") || "Default") : null}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={status} label={statusLabel} />
                </TableCell>
                <TableCell className="py-3.5 text-sm text-muted-foreground">
                  {channelLabel}
                </TableCell>
                <TableCell className="py-3.5 font-mono text-sm text-muted-foreground">
                  {list.code || "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex justify-end">
                    <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                      {list.currency || "USD"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("common.openMenu") || "Open menu"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(list)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t("priceLists.editAction") || "Edit list"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpen(list.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        {t("priceLists.managePrices") || "Manage prices"}
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
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
          {" – "}
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + lists.length, totalCount)}</span>
          {" of "}
          <span className="font-medium text-foreground">{totalCount}</span>
          {" "}
          {t("priceLists.table.lists") || "price lists"}
        </p>
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  )
}

export function PriceListsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 6 }).map((_, index) => (
              <DocumentListHead key={index} align={index === 4 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index === 4 && "ml-auto")} />
              </DocumentListHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-5 w-12" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
