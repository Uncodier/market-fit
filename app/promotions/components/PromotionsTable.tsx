"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Pagination } from "@/app/components/ui/pagination"
import { ExternalLink, Tag } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { formatPromotionDiscountLabel } from "../bogo-discount"
import { PromotionWithCampaign } from "../types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function promotionAccent(status: string): "due" | "cancelled" | "none" {
  if (status === "expired") return "cancelled"
  if (status === "draft" || status === "paused") return "due"
  return "none"
}

interface PromotionsTableProps {
  promotions: PromotionWithCampaign[]
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onOpen: (id: string) => void
  onCreate?: () => void
}

export function PromotionsTable({
  promotions,
  page,
  pageSize,
  totalCount,
  onPageChange,
  onOpen,
  onCreate,
}: PromotionsTableProps) {
  const { t } = useLocalization()
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize

  if (promotions.length === 0) {
    return (
      <EmptyCard
        icon={<Tag className="h-6 w-6 text-muted-foreground" />}
        title={t("promotions.empty.title") || "No promotions found"}
        description={t("promotions.empty.description") || "Create a discount code or automatic promotion."}
        actionButton={
          onCreate ? (
            <Button onClick={onCreate} variant="outline">
              {t("promotions.add") || "Create Promotion"}
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[820px]">
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[32%]">{t("promotions.table.promotion") || "Promotion"}</DocumentListHead>
              <DocumentListHead className="w-[14%]">{t("promotions.table.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[18%]">{t("promotions.table.campaign") || "Campaign"}</DocumentListHead>
              <DocumentListHead className="w-[12%]">{t("promotions.table.uses") || "Uses"}</DocumentListHead>
              <DocumentListHead className="w-[14%]" align="right">{t("promotions.table.discount") || "Discount"}</DocumentListHead>
              <DocumentListHead className="w-[10%]" align="right">{t("promotions.table.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((promo) => {
              const statusLabel = t(`promotions.status.${promo.status}`) || promo.status
              const uses = promo.usage_limit
                ? `${promo.usage_count} / ${promo.usage_limit}`
                : String(promo.usage_count ?? 0)
              const meta = [
                promo.applies_to === "selected_items" ? (t("promotions.table.selectedItems") || "Selected items") : null,
                promo.starts_at || promo.ends_at ? (t("promotions.table.scheduled") || "Scheduled") : null,
              ]
                .filter(Boolean)
                .join(" · ") || null

              return (
                <DocumentListRow
                  key={promo.id}
                  onClick={() => onOpen(promo.id)}
                  accent={promotionAccent(promo.status)}
                >
                  <TableCell className="py-3.5">
                    <EntityCell
                      name={promo.name}
                      secondary={promo.code ? promo.code : null}
                      meta={meta}
                    />
                  </TableCell>
                  <TableCell className="py-3.5">
                    <StatusDot status={promo.status} label={statusLabel} />
                  </TableCell>
                  <TableCell className="py-3.5 text-sm text-muted-foreground">
                    {promo.campaigns?.title || "—"}
                  </TableCell>
                  <TableCell className="py-3.5 text-sm tabular-nums text-muted-foreground">
                    {uses}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex flex-col items-end gap-0.5">
                      <span
                        className={cn(
                          "text-[15px] font-semibold tabular-nums tracking-tight",
                          promo.status === "expired" && "text-muted-foreground line-through decoration-muted-foreground/60"
                        )}
                      >
                        {formatPromotionDiscountLabel(promo)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onOpen(promo.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">{t("common.open") || "Open"}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("common.open") || "Open"}</TooltipContent>
                    </Tooltip>
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
            <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + promotions.length, totalCount)}</span>
            {" of "}
            <span className="font-medium text-foreground">{totalCount}</span>
            {" "}
            {t("promotions.table.promotions") || "promotions"}
          </p>
          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

export function PromotionsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: 6 }).map((_, index) => (
              <DocumentListHead key={index} align={index >= 4 ? "right" : "left"}>
                <Skeleton className={cn("h-3 w-16", index >= 4 && "ml-auto")} />
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
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-12" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-5 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="ml-auto h-8 w-8 rounded-md" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
