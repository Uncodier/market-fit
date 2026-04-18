"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Lead } from "@/app/leads/types"
import { cn } from "@/lib/utils"

/** Matches pipeline status colors in `kanban-view.tsx`. */
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  qualified: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  cold: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  converted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  not_qualified: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
}

const STATUS_LABELS: Record<Lead["status"], string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  cold: "Cold",
  converted: "Converted",
  lost: "Lost",
  not_qualified: "Not qualified",
}

function getCompanyName(lead: Lead): string | null {
  if (lead.companies?.name) return lead.companies.name
  if (lead.company && typeof lead.company === "object" && lead.company.name) {
    return lead.company.name
  }
  if (typeof lead.company === "string") return lead.company
  return null
}

export function ImprentaLeadKanbanMiniCardSkeleton() {
  return (
    <Card className="w-full max-w-[320px] mx-auto transition-shadow duration-200">
      <CardHeader className="px-3 h-[50px] flex flex-row items-center justify-between">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-[70%] max-w-[200px]" />
        </div>
        <div className="flex-shrink-0 m-0" style={{ marginBottom: "6px" }}>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <div className="border-t dark:border-white/5 border-black/5 mx-3" />
      <CardContent className="p-3 pt-2 pb-3">
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-[80%] mb-2" />
        <Skeleton className="h-3 w-[60%] mb-2" />
        <div className="flex items-center justify-between mt-2 gap-2">
          <Skeleton className="h-5 w-24 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

type ImprentaLeadKanbanMiniCardProps = {
  lead: Lead
  /** From `audience_leads.send_status` when showing an audience row. */
  audienceSendStatus?: string | null
}

export function ImprentaLeadKanbanMiniCard({
  lead,
  audienceSendStatus,
}: ImprentaLeadKanbanMiniCardProps) {
  const company = getCompanyName(lead)
  const statusClass = STATUS_COLORS[lead.status] ?? STATUS_COLORS.new

  return (
    <Link href={`/leads/${lead.id}`} className="block w-full max-w-[320px] mx-auto">
      <Card className="w-full transition-shadow duration-200 hover:shadow-md cursor-pointer">
        <CardHeader className="px-3 h-[50px] flex flex-row items-center justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium truncate" title={lead.name}>
              {lead.name}
            </CardTitle>
          </div>
          <div className="flex-shrink-0 m-0" style={{ marginBottom: "6px" }}>
            <Badge className={cn("text-xs m-0", statusClass)}>
              {STATUS_LABELS[lead.status] ?? lead.status}
            </Badge>
          </div>
        </CardHeader>
        <div className="border-t dark:border-white/5 border-black/5 mx-3" />
        <CardContent className="p-3 pt-2 pb-0">
          <div
            className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate"
            title={lead.email}
          >
            {lead.email}
          </div>
          {lead.phone ? (
            <div
              className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate"
              title={lead.phone}
            >
              {lead.phone}
            </div>
          ) : null}
          {company ? (
            <div
              className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate"
              title={company}
            >
              {company}
            </div>
          ) : null}
          <div className="flex items-center justify-between mt-2 mb-3 flex-wrap gap-1">
            {audienceSendStatus ? (
              <Badge variant="outline" className="text-[10px] uppercase truncate max-w-[140px]">
                {audienceSendStatus}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
