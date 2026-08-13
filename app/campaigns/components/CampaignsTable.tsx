"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Target } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"
import { format, isBefore, startOfDay } from "date-fns"
import { Campaign } from "@/app/types"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-zinc-400",
}

function humanizeType(type: string) {
  if (type === "publicRelations") return "Public Relations"
  return type.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase())
}

function formatDueDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

function isOverdue(campaign: Campaign) {
  if (!campaign.dueDate || campaign.status === "completed") return false
  try {
    return isBefore(new Date(campaign.dueDate), startOfDay(new Date()))
  } catch {
    return false
  }
}

function campaignRoi(campaign: Campaign) {
  const budget = campaign.budget?.allocated ?? 0
  if (budget <= 0) return null
  const revenue = campaign.revenue?.actual ?? 0
  return ((revenue - budget) / budget) * 100
}

interface CampaignsTableProps {
  campaigns: Campaign[]
  onCampaignClick: (campaign: Campaign) => void
}

export function CampaignsTable({ campaigns, onCampaignClick }: CampaignsTableProps) {
  const { t } = useLocalization()

  if (campaigns.length === 0) {
    return (
      <EmptyCard
        icon={<Target className="h-16 w-16 text-muted-foreground" />}
        title={t("campaigns.empty.title") || "No Campaigns"}
        description={t("campaigns.empty.desc") || "You don't have any campaigns yet. Create your first campaign to get started."}
      />
    )
  }

  const totalRevenue = campaigns.reduce((sum, campaign) => sum + (campaign.revenue?.actual ?? 0), 0)
  const totalBudget = campaigns.reduce((sum, campaign) => sum + (campaign.budget?.allocated ?? 0), 0)

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[860px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[32%]">{t("campaigns.table.campaign") || "Campaign"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("campaigns.table.status") || "Status"}</DocumentListHead>
            <DocumentListHead className="w-[12%]">{t("campaigns.table.priority") || "Priority"}</DocumentListHead>
            <DocumentListHead className="w-[14%]">{t("campaigns.table.due") || "Due"}</DocumentListHead>
            <DocumentListHead className="w-[15%]" align="right">{t("campaigns.stats.revenue") || "Revenue"}</DocumentListHead>
            <DocumentListHead className="w-[15%]" align="right">{t("campaigns.stats.budget") || "Budget"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const status = campaign.status || "active"
            const statusLabel = t(`campaigns.status.${status}`) || status
            const priorityLabel = t(`campaigns.priority.${campaign.priority}`) || campaign.priority
            const typeLabel = t(`campaigns.type.${campaign.type}`) || humanizeType(campaign.type || "")
            const overdue = isOverdue(campaign)
            const roi = campaignRoi(campaign)
            const remaining = campaign.budget?.remaining
            const segments = (campaign.segmentObjects || []).map((segment) => segment.name).filter(Boolean)
            const meta = segments.length > 0 ? segments.slice(0, 2).join(" · ") : (campaign.description || null)

            return (
              <DocumentListRow
                key={campaign.id}
                onClick={() => onCampaignClick(campaign)}
                accent={overdue ? "due" : "none"}
              >
                <TableCell className="py-3.5">
                  <EntityCell
                    name={campaign.title}
                    secondary={typeLabel}
                    meta={meta}
                    secondaryMono={false}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <StatusDot status={status} label={statusLabel} />
                </TableCell>
                <TableCell className="py-3.5">
                  <span className="inline-flex items-center gap-2 text-sm capitalize text-foreground">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_DOT[campaign.priority] || "bg-zinc-400")} />
                    {priorityLabel}
                  </span>
                </TableCell>
                <TableCell className={cn(
                  "py-3.5 text-sm whitespace-nowrap",
                  overdue ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                )}>
                  {campaign.dueDate ? formatDueDate(campaign.dueDate) : "—"}
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                      {formatCurrency(campaign.revenue?.actual || 0)}
                    </span>
                    {roi !== null && (
                      <span className={cn(
                        "text-[11px] font-medium tabular-nums",
                        roi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {roi >= 0 ? "+" : ""}{Math.round(roi)}% {t("campaigns.table.roi") || "ROI"}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3.5">
                  <MoneyCell
                    amountLabel={formatCurrency(campaign.budget?.allocated || 0)}
                    dueLabel={
                      typeof remaining === "number" && remaining < 0
                        ? t("campaigns.stats.overBudget") || "Over budget"
                        : null
                    }
                    paidLabel={
                      typeof remaining === "number" && remaining >= 0
                        ? `${formatCurrency(remaining)} ${t("campaigns.stats.remaining") || "remaining"}`
                        : null
                    }
                  />
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
        <tfoot>
          <tr className="bg-muted/30">
            <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {t("campaigns.stats.total") || "Total"}
            </TableCell>
            <TableCell colSpan={3} />
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(totalRevenue)} />
            </TableCell>
            <TableCell className="py-3">
              <MoneyCell amountLabel={formatCurrency(totalBudget)} />
            </TableCell>
          </tr>
        </tfoot>
      </Table>
      <div className="border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{campaigns.length}</span>{" "}
          {t("campaigns.table.campaigns") || "campaigns"}
        </p>
      </div>
    </div>
  )
}

export function CampaignsTableSkeleton() {
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
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell className="py-3.5"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
