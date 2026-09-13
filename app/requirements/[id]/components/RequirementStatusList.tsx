"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ExternalLink, Info } from "@/app/components/ui/icons"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { robotsInstanceHref } from "@/lib/navigation/robots-instance"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface RequirementStatus {
  id: string
  site_id: string
  instance_id: string | null
  asset_id: string | null
  requirement_id: string
  source_code?: string | null
  repo_url?: string | null
  stage: string
  message: string | null
  preview_url: string | null
  created_at: string
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return "—"
  }
}

const getStageBadge = (stage: string) => {
  if (!stage) return <Badge variant="outline">Unknown</Badge>;
  const lowerStage = stage.toLowerCase();
  if (lowerStage.includes('error') || lowerStage.includes('fail')) {
    return <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-xs px-2 py-0.5">{stage}</Badge>
  }
  if (lowerStage.includes('success') || lowerStage.includes('complet') || lowerStage.includes('done')) {
    return <Badge className="bg-success/20 text-success border-success/20 text-xs px-2 py-0.5">{stage}</Badge>
  }
  if (lowerStage.includes('progress') || lowerStage.includes('run') || lowerStage.includes('review')) {
    return <Badge className="bg-info/20 text-info border-info/20 text-xs px-2 py-0.5">{stage}</Badge>
  }
  return <Badge variant="outline" className="bg-secondary/20 text-secondary-foreground border-secondary/20 text-xs px-2 py-0.5">{stage}</Badge>
}

function StatusItem({ status, t }: { status: RequirementStatus, t: any }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Heuristic for long text
  const isLong = status.message && status.message.length > 150
  
  return (
    <div className="flex flex-col gap-2.5 p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center mt-0.5">
          {getStageBadge(status.stage)}
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 leading-tight">
          {formatDate(status.created_at)}
        </span>
      </div>
      
      {status.message && (
        <div className="flex flex-col gap-1.5">
          <div 
            className={cn(
              "text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed break-words",
              !isExpanded && "line-clamp-3"
            )}
          >
            {status.message}
          </div>
          {isLong && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground text-left transition-colors w-fit"
            >
              {isExpanded ? "View less" : "View more"}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {status.preview_url && (
          <a 
            href={status.preview_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-400 hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('requirements.preview') || 'Preview'}
          </a>
        )}
        {(status.source_code || status.repo_url) && (
          <a 
            href={status.source_code || status.repo_url || undefined} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('requirements.sourceCode') || 'Source Code'}
          </a>
        )}
        {status.instance_id && (
          <Link
            href={robotsInstanceHref(status.instance_id)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            <Info className="h-3 w-3" />
            Instance
          </Link>
        )}
      </div>
    </div>
  )
}

export function RequirementStatusList({
  requirementId,
  hasContent,
}: {
  requirementId: string
  hasContent?: boolean
}) {
  const { t } = useLocalization()
  const [statuses, setStatuses] = useState<RequirementStatus[]>([])
  const [loading, setLoading] = useState(true)

  const loadStatuses = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("requirement_status")
      .select("*")
      .eq("requirement_id", requirementId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error loading requirement statuses:", error)
      toast.error("Failed to load requirement history")
      setStatuses([])
    } else {
      setStatuses(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadStatuses()
  }, [requirementId])

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col overflow-auto p-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-3 pb-4 border-b">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (statuses.length === 0) {
    return (
      <div className="w-full p-8 text-center">
        <div className="text-sm text-muted-foreground/60">No Activity Yet</div>
      </div>
    )
  }

  return (
    <div className="w-full h-full overflow-auto flex flex-col">
      {statuses.map((status) => (
        <StatusItem key={status.id} status={status} t={t} />
      ))}
    </div>
  )
}