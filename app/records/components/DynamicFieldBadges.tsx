import { useScopedPreviewState } from "../hooks/useScopedPreviewState"
import { buildPreviewRequests, fieldPreviewKey, fetchPreviewBatches } from "../lib/entity-preview-request"
import React, { useEffect, useState, useMemo } from "react"
import { RecordItem, resolveRelationsForSidebar } from "../actions"
import { MapPin, ImageIcon, LinkIcon } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { publicPromptImageUrl } from "@/app/lib/image-utils"

interface DynamicFieldBadgesProps {
  record: RecordItem
  className?: string
  limit?: number
  ignoreFields?: string[]
}

export function DynamicFieldBadges({ record, className, limit = 5, ignoreFields = [] }: DynamicFieldBadgesProps) {
  const [resolvedRelations, setResolvedRelations] = useScopedPreviewState<Record<string, string>>(record.site_id, {})
  const [isResolving, setIsResolving] = useState(false)

  const templateFields = record.category?.template_fields || []
  
  const displayableFields = useMemo(() => {
    return templateFields.filter(f => {
      if (ignoreFields.includes(f.name)) return false
      const type = f.type
      const hasValue = (record.data && record.data[f.name]) || (record.relations && record.relations[f.name])
      const isDisplayableType = type === 'location' || type === 'file' || type === 'relation' || f.aiPreview?.enabled
      return isDisplayableType && hasValue
    }).slice(0, limit)
  }, [templateFields, record, limit])

  useEffect(() => {
    let active = true
    setResolvedRelations({})
    setIsResolving(false)
    const requests = buildPreviewRequests(displayableFields, record.relations || {})
    if (record.site_id && requests.length) {
      setIsResolving(true)
      fetchPreviewBatches(requests, record.site_id, resolveRelationsForSidebar).then(resolved => {
        if (active) { setResolvedRelations(resolved); setIsResolving(false) }
      })
    }
    return () => { active = false }
  }, [displayableFields, record.relations, record.site_id])

  if (displayableFields.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-1.5 mt-2", className)}>
      {displayableFields.map(field => {
        const type = field.type
        const value = record.data?.[field.name]
        const relationId = record.relations?.[field.name]

        let icon = null
        let text = null
        let imageUrl = null

        if (field.aiPreview?.enabled && value) {
            const prompt = (field.aiPreview.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, String(value))
            imageUrl = publicPromptImageUrl(prompt, 64)
            text = field.name
        } else if (type === 'location' && value) {
          icon = <MapPin className="w-3 h-3 text-muted-foreground/80 shrink-0" />
          text = value
        } else if (type === 'file' && value) {
          icon = <ImageIcon className="w-3 h-3 text-muted-foreground/80 shrink-0" />
          text = typeof value === 'string' ? value.split('/').pop() : 'File'
          
          if (typeof value === 'string' && value.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
              imageUrl = value
          }

        } else if (type === 'relation' && relationId) {
          icon = <LinkIcon className="w-3 h-3 text-muted-foreground/80 shrink-0" />
          text = resolvedRelations[fieldPreviewKey(field, relationId)] || (isResolving ? "..." : relationId.substring(0, 8))
        } else {
            return null
        }

        return (
          <div 
            key={field.id}
            className="flex items-center gap-1.5 px-1.5 py-[3px] rounded-md bg-muted/40 text-muted-foreground border border-border/50 hover:bg-muted/60 transition-colors cursor-default max-w-full"
            title={text}
          >
            {imageUrl ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img src={imageUrl} alt={field.name} className="w-4 h-4 rounded-sm object-cover bg-muted shrink-0" loading="lazy" />
            ) : icon}
            <span className="text-[11px] font-medium leading-none truncate max-w-[140px]">
              {text}
            </span>
          </div>
        )
      })}
    </div>
  )
}
