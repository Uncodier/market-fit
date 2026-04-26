"use client"

import { useEffect, useState } from "react"
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/app/components/ui/accordion"
import { ExternalLink, Info } from "@/app/components/ui/icons"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

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
      <div className="w-full pb-8 mt-auto px-4 lg:px-8">
        <hr className="my-6 border-border/40" />
        <div className="text-xs font-mono text-muted-foreground animate-pulse">Loading feed...</div>
      </div>
    )
  }

  if (statuses.length === 0) {
    return (
      <div className="w-full pb-8 mt-auto px-4 lg:px-8 prose prose-sm dark:prose-invert max-w-none">
        <hr className="my-6 border-border/40" />
        <div className="text-xs font-mono text-muted-foreground/40 uppercase tracking-widest mb-4">No Activity Yet</div>
      </div>
    )
  }

  return (
    <div className="w-full pb-8 mt-auto px-4 lg:px-8 prose prose-sm dark:prose-invert max-w-none">
      <hr className="my-6 border-border/40" />
      <div className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mb-4">Requirement Feed</div>
      <div className="w-full">
        <Accordion 
          type="multiple" 
          defaultValue={statuses.map(s => s.id)}
          className="w-full font-mono text-sm space-y-2 not-prose"
        >
          {statuses.map((status) => (
            <AccordionItem
              key={status.id}
              value={status.id}
              className="border-none"
            >
              <AccordionTrigger className="hover:no-underline py-3 px-0 flex flex-row-reverse justify-end gap-3 hover:bg-transparent [&>svg]:text-muted-foreground/50 [&>svg]:mt-1 font-normal items-start">
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <span className="text-muted-foreground/60 text-[11px] font-mono tracking-wider flex gap-2">
                    <span>
                      {new Date(status.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </span>
                    <span>
                      {new Date(status.created_at).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      })}
                    </span>
                  </span>
                  <span className="text-blue-500/90 font-semibold text-sm leading-snug">
                    {status.stage}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-2">
                <div className="pl-6 space-y-3 border-l border-border/50 ml-[7px] mt-1 mb-2">
                  {status.message && (
                    <div className="text-foreground/70 whitespace-pre-wrap text-[13px] leading-relaxed">
                      {status.message}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-4 pt-1">
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
                        className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/80 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {t('requirements.sourceCode') || 'Source Code'}
                      </a>
                    )}
                    {status.instance_id && (
                      <a 
                        href={`/robots?instance_id=${status.instance_id}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-foreground/80 hover:underline"
                      >
                        <Info className="h-3 w-3" />
                        Instance
                      </a>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
