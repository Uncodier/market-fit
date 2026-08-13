"use client"

import React, { useState } from "react"
import { Subscription } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, Play, Pause, Ban, Repeat } from "@/app/components/ui/icons"
import { updateSubscriptionStatus } from "../actions"
import { toast } from "sonner"
import { format } from "date-fns"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/app/lib/formatters"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function subscriptionAccent(status: Subscription["status"]): "due" | "cancelled" | "none" {
  if (status === "cancelled" || status === "expired") return "cancelled"
  if (status === "paused") return "due"
  return "none"
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (isNaN(date.getTime())) return null
  return format(date, "MMM d, yyyy")
}

interface SubscriptionsListProps {
  subscriptions: Subscription[]
  siteId: string
  onUpdate: () => void
}

export function SubscriptionsList({ subscriptions, siteId, onUpdate }: SubscriptionsListProps) {
  const { t } = useLocalization()
  const [updating, setUpdating] = useState<string | null>(null)
  const pageTotal = subscriptions.reduce((sum, sub) => sum + (Number(sub.amount) || 0), 0)

  const handleStatusChange = async (id: string, status: Subscription["status"]) => {
    setUpdating(id)
    const { error } = await updateSubscriptionStatus(siteId, id, status)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("subscriptions.updated") || "Subscription updated")
      onUpdate()
    }
    setUpdating(null)
  }

  if (subscriptions.length === 0) {
    return (
      <EmptyCard
        icon={<Repeat size={24} className="text-muted-foreground" />}
        title={t("subscriptions.empty.title") || "No subscriptions found"}
        description={
          t("subscriptions.empty.description") ||
          "When customers purchase recurring plans, they will appear here."
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[760px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[34%]">{t("subscriptions.table.customer") || "Customer"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("subscriptions.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[18%]">{t("subscriptions.table.nextBilling") || "Next billing"}</DocumentListHead>
            <DocumentListHead className="w-[22%]" align="right">{t("subscriptions.table.amount") || "Amount"}</DocumentListHead>
            <DocumentListHead className="w-[12%]" align="right">{t("subscriptions.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => {
            const customer = sub.lead?.name || t("subscriptions.table.unknownCustomer") || "Unknown Customer"
            const plan = sub.catalog_item?.name || t("subscriptions.table.unknownPlan") || "Unknown Plan"
            const statusLabel = t(`subscriptions.status.${sub.status}`) || sub.status
            const nextBilling = formatDate(sub.next_billing_date)
            const cancelled = sub.status === "cancelled" || sub.status === "expired"
            const amount = Number(sub.amount) || 0

            return (
              <DocumentListRow key={sub.id} accent={subscriptionAccent(sub.status)}>
                <TableCell className="py-3.5">
                  <EntityCell
                    name={customer}
                    secondary={sub.lead?.email || null}
                    meta={plan}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={sub.status} label={statusLabel} />
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {nextBilling || "—"}
                  </div>
                  {sub.end_date && formatDate(sub.end_date) ? (
                    <div className="text-[11px] text-muted-foreground/80">
                      {t("subscriptions.table.ends") || "Ends"} {formatDate(sub.end_date)}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(amount)}
                    dueLabel={sub.status === "paused" ? t("subscriptions.status.paused") || "Paused" : null}
                    paidLabel={
                      sub.status === "active"
                        ? t("subscriptions.table.perCycle") || "per cycle"
                        : null
                    }
                    cancelled={cancelled}
                  />
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                        disabled={updating === sub.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("subscriptions.table.actions") || "Actions"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {sub.status !== "active" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(sub.id, "active")}>
                          <Play className="h-4 w-4 mr-2" />
                          {t("subscriptions.table.activate") || "Activate"}
                        </DropdownMenuItem>
                      )}
                      {sub.status === "active" && (
                        <DropdownMenuItem onClick={() => handleStatusChange(sub.id, "paused")}>
                          <Pause className="h-4 w-4 mr-2" />
                          {t("subscriptions.table.pause") || "Pause"}
                        </DropdownMenuItem>
                      )}
                      {sub.status !== "cancelled" && (
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(sub.id, "cancelled")}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          {t("subscriptions.table.cancel") || "Cancel"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
        <tfoot>
          <tr className="bg-muted/30">
            <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("subscriptions.table.total") || "Total"}
            </TableCell>
            <TableCell colSpan={2} />
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(pageTotal)} />
            </TableCell>
            <TableCell />
          </tr>
        </tfoot>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{subscriptions.length}</span>
          {" "}
          {t("subscriptions.table.subscriptions") || "subscriptions"}
        </p>
      </div>
    </div>
  )
}

export function SubscriptionsListSkeleton() {
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
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-14" />
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
