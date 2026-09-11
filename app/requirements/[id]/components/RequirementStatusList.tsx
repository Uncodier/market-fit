"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ExternalLink, Info } from "@/app/components/ui/icons"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"
import { robotsInstanceHref } from "@/lib/navigation/robots-instance"
import Link from "next/link"

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
    return <Badge className="bg-destructive/20 text-destructive border-destructive/20">{stage}</Badge>
  }
  if (lowerStage.includes('success') || lowerStage.includes('complet')) {
    return <Badge className="bg-success/20 text-success border-success/20">{stage}</Badge>
  }
  if (lowerStage.includes('progress') || lowerStage.includes('run')) {
    return <Badge className="bg-info/20 text-info border-info/20">{stage}</Badge>
  }
  return <Badge variant="outline" className="bg-secondary/20 text-secondary-foreground border-secondary/20">{stage}</Badge>
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
      <div className="w-full h-full flex flex-col overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Stage</TableHead>
              <TableHead className="min-w-[150px]">Details</TableHead>
              <TableHead className="w-[120px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    <div className="w-full h-full overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow>
            <TableHead className="w-[120px]">Stage</TableHead>
            <TableHead className="min-w-[150px]">Details</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.map((status) => (
            <TableRow key={status.id} className="group hover:bg-muted/50 transition-colors">
              <TableCell className="align-top py-4">{getStageBadge(status.stage)}</TableCell>
              <TableCell className="py-4">
                <div className="space-y-2">
                  {status.message && (
                    <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                      {status.message}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {status.preview_url && (
                      <a 
                        href={status.preview_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-400 hover:underline"
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
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t('requirements.sourceCode') || 'Source Code'}
                      </a>
                    )}
                    {status.instance_id && (
                      <Link
                        href={robotsInstanceHref(status.instance_id)}
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
                      >
                        <Info className="h-3 w-3" />
                        Instance
                      </Link>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="align-top py-4 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(status.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}