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
  const [resolvedRelations, setResolvedRelations] = useState<Record<string, string>>({})
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
    const relationFields = displayableFields.filter(f => f.type === 'relation')
    if (relationFields.length === 0) return

    const resolveRelations = async () => {
      setIsResolving(true)
      const entitiesToResolve: { target: string; ids: string[] }[] = []
      
      const targetMap = new Map<string, string[]>()
      
      relationFields.forEach(f => {
        const target = f.relationTarget || "lead"
        const id = record.relations?.[f.name]
        if (id) {
          if (!targetMap.has(target)) targetMap.set(target, [])
          targetMap.get(target)?.push(id)
        }
      })

      targetMap.forEach((ids, target) => {
        entitiesToResolve.push({ target, ids: Array.from(new Set(ids)) })
      })

      if (entitiesToResolve.length > 0) {
        const resolved = await resolveRelationsForSidebar(entitiesToResolve)
        setResolvedRelations(resolved)
      }
      setIsResolving(false)
    }

    resolveRelations()
  }, [displayableFields, record.relations])

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
          text = resolvedRelations[relationId] || (isResolving ? "..." : relationId.substring(0, 8))
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
