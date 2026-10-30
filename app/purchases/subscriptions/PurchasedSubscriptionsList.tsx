"use client"

import { useState } from "react"
import Link from "next/link"
import { format, parseISO } from "date-fns"
import { toast } from "sonner"
import { cancelBuyerSubscription } from "@/app/buyer/actions"
import { canCancelSubscription } from "@/app/buyer/subscription-utils"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Ban, ExternalLink, MoreHorizontal, Repeat } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { DocumentListHead, DocumentListRow, EntityCell, MoneyCell, StatusDot, documentListShellClassName } from "@/app/components/documents/document-list"
import { formatCurrency } from "@/app/lib/formatters"
import type { PurchasedSubscription } from "./types"

function dateLabel(value?: string | null) {
  if (!value) return "—"
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "MMM d, yyyy")
}

export function PurchasedSubscriptionsListSkeleton() {
  return <div className={documentListShellClassName()}><Table>
    <TableHeader><TableRow>{Array.from({ length: 6 }, (_, index) => <DocumentListHead key={index}><Skeleton className="h-3 w-16" /></DocumentListHead>)}</TableRow></TableHeader>
    <TableBody>{Array.from({ length: 6 }, (_, row) => <TableRow key={row}>{Array.from({ length: 6 }, (_, cell) => <TableCell key={cell} className="py-3.5"><Skeleton className={cell === 0 ? "h-9 w-40" : "h-4 w-16"} /></TableCell>)}</TableRow>)}</TableBody>
  </Table></div>
}

export function PurchasedSubscriptionsList({ subscriptions, onUpdate, demo = false }: {
  subscriptions: PurchasedSubscription[]
  onUpdate: () => void | Promise<unknown>
  demo?: boolean
}) {
  const { t } = useLocalization()
  const permissions = useOptionalPermissions()
  const [selected, setSelected] = useState<PurchasedSubscription | null>(null)
  const canUpdate = !demo && (!permissions || (!permissions.isViewOnly && permissions.can("update")))

  async function cancel() {
    if (!selected || !canUpdate) throw new Error("Cancellation unavailable")
    try {
      const result = await cancelBuyerSubscription(selected.id)
      if (result.error) throw new Error(result.error)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel subscription")
      throw error
    }
    toast.success(t("subscriptions.updated") || "Subscription updated")
    void onUpdate()
  }

  if (!subscriptions.length) return (
    <EmptyCard icon={<Repeat size={40} className="text-muted-foreground" />}
      title={t("buyer.subscriptions.empty.title") || "No subscriptions"}
      description="Purchased recurring plans will appear here. Try adjusting your search or filters." />
  )

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[920px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[28%]">Supplier / plan</DocumentListHead>
            <DocumentListHead>{t("subscriptions.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead>{t("subscriptions.table.nextBilling") || "Next billing"}</DocumentListHead>
            <DocumentListHead>Included access</DocumentListHead>
            <DocumentListHead align="right">{t("subscriptions.table.amount") || "Amount"}</DocumentListHead>
            <DocumentListHead align="right">{t("subscriptions.table.actions") || "Actions"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => {
            const plan = sub.catalog_item?.name || "Unknown plan"
            const planUrl = `/shop/${sub.site?.id || sub.site_id}/${sub.catalog_item?.id || sub.catalog_item_id}`
            return (
              <DocumentListRow key={sub.id} accent={sub.status === "paused" ? "due" : sub.status === "cancelled" || sub.status === "expired" ? "cancelled" : "none"}>
                <TableCell className="py-3.5">
                  {demo ? <EntityCell name={sub.site?.name || "Unknown supplier"} meta={plan} secondary={`Started ${dateLabel(sub.start_date)}`} secondaryMono={false} /> : <Link href={planUrl} className="block rounded-md focus-visible:outline focus-visible:outline-2">
                    <EntityCell name={sub.site?.name || "Unknown supplier"} meta={plan} secondary={`Started ${dateLabel(sub.start_date)}`} secondaryMono={false} />
                  </Link>}
                </TableCell>
                <TableCell className="py-3.5"><StatusDot status={sub.status} label={t(`subscriptions.status.${sub.status}`) || sub.status} /></TableCell>
                <TableCell className="py-3.5">
                  <div className="text-sm text-muted-foreground whitespace-nowrap">{dateLabel(sub.next_billing_date)}</div>
                  {sub.end_date && <div className="text-[11px] text-muted-foreground">Ends {dateLabel(sub.end_date)}</div>}
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex flex-col gap-1">
                    {sub.entitlements?.length ? sub.entitlements.map((access) => (
                      demo ? <span key={access.id} className="text-xs text-muted-foreground">{access.catalog_item?.name || "View access"}{access.uses_remaining != null ? ` · ${access.uses_remaining} uses` : ""}</span> : <Link key={access.id} href={access.catalog_item?.digital_subtype === "pass" ? `/buyer/book/${access.id}` : "/purchases/library"} className="text-xs hover:underline">
                        {access.catalog_item?.name || "View access"}
                        {access.catalog_item?.digital_subtype === "pass" && access.uses_remaining != null ? ` · ${access.uses_remaining} uses` : ""}
                      </Link>
                    )) : <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </TableCell>
                <TableCell className="py-3.5"><MoneyCell amountLabel={formatCurrency(Number(sub.amount) || 0, sub.catalog_item?.currency || "USD")} cancelled={sub.status === "cancelled" || sub.status === "expired"} /></TableCell>
                <TableCell className="py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions for ${plan}`}><MoreHorizontal size={16} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {demo ? <DropdownMenuItem disabled><ExternalLink size={14} className="mr-2" />View plan</DropdownMenuItem> : <DropdownMenuItem asChild><Link href={planUrl}><ExternalLink size={14} className="mr-2" />View plan</Link></DropdownMenuItem>}
                      {canCancelSubscription(sub) && <DropdownMenuItem disabled={!canUpdate} data-permission="update" className="text-destructive" onClick={() => setSelected(sub)}><Ban size={14} className="mr-2" />Cancel subscription</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">{subscriptions.length} {t("subscriptions.table.subscriptions") || "subscriptions"}</div>
      <ConfirmDialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null) }}
        title="Cancel subscription?" description={`Cancel ${selected?.catalog_item?.name || "this subscription"}? Included access will be revoked.`}
        confirmLabel="Cancel subscription" cancelLabel="Keep subscription" variant="destructive" dataPermission="update" onConfirm={cancel} />
    </div>
  )
}