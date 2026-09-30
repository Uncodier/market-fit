import type { SyntheticEvent } from "react"
import { Sparkles } from "@/app/components/ui/icons"
import { publicPromptImageUrl } from "@/app/lib/image-utils"
import type { RecordItem } from "../../actions"
import type { InsightField, InsightsTabProps } from "./insights-types"

interface GeneratedPreviewsProps extends InsightsTabProps {
  activeRelations: InsightField[]
  allRelationLabels: Record<string, string>
  categoryHistory: RecordItem[]
}

interface PreviewItem {
  id: string
  value: string
  label: string
  isCurrent: boolean
  date: number
}

function showImagePlaceholder(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget
  const placeholder = "/images/image-placeholder.svg"
  // React delegates error events; guard the src instead of only clearing onerror.
  if (image.getAttribute("src") !== placeholder) {
    image.src = placeholder
  }
}

export function InsightGeneratedPreviews({
  fields, formData, record, relationsData, activeRelations, allRelationLabels, categoryHistory,
}: GeneratedPreviewsProps) {
  return (
    <>
      {fields.filter(f => f.aiPreview?.enabled).length > 0 && (
        <section>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Generated Previews</span>
          </div>
          <div className="space-y-8">
            {fields.filter(f => f.aiPreview?.enabled).map(previewField => {
              
              const hasActiveRelations = activeRelations.length > 0
              
              if (hasActiveRelations) {
                return activeRelations.map(rel => {
                  const relId = relationsData?.[rel.name]
                  if (!relId) return null

                  const relLabel = allRelationLabels[relId] || relId
                  
                  // Find all records that share this relation
                  const relatedRecords = categoryHistory.filter(h => h.relations?.[rel.name] === relId)
                  
                  // Build carousel items
                  const items: PreviewItem[] = []
                  
                  // Add history records first (oldest to newest)
                  relatedRecords.forEach(h => {
                    if (h.id !== record?.id && h.data[previewField.name]) {
                      items.push({
                        id: h.id,
                        value: h.data[previewField.name],
                        label: new Date(h.created_at).toLocaleDateString(),
                        isCurrent: false,
                        date: new Date(h.created_at).getTime()
                      })
                    }
                  })
                  
                  items.sort((a, b) => a.date - b.date)
                  
                  // Add current record last
                  if (formData[previewField.name]) {
                    items.push({
                      id: record?.id || 'current',
                      value: formData[previewField.name],
                      label: 'Current',
                      isCurrent: true,
                      date: Date.now()
                    })
                  }
                  
                  if (items.length === 0) return null

                  return (
                    <div key={`${previewField.id}-${rel.id}`}>
                      <h4 className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        {previewField.name} - {relLabel}
                      </h4>
                      <div className="flex gap-2 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {items.map(item => {
                          const finalPrompt = (previewField.aiPreview?.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, item.value)
                          const url = publicPromptImageUrl(finalPrompt, 512, record?.site_id)
                          
                          return (
                            <div key={item.id} className={`flex-none w-28 rounded-lg overflow-hidden relative group shadow-sm border ${item.isCurrent ? 'border-primary' : 'border-border/40'} snap-start`}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img 
                                src={url} 
                                alt={item.value} 
                                className="w-full h-24 object-cover bg-muted/20" 
                                onError={showImagePlaceholder}
                              />
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium transition-opacity backdrop-blur-sm"
                              >
                                <span>Full Size</span>
                                <span className="text-[9px] mt-1 font-normal opacity-80 max-w-[90%] truncate px-1 text-center">{item.value}</span>
                              </a>
                              <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded backdrop-blur-md truncate max-w-[90%]">
                                {item.label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              } else {
                // If no relations, just show current
                if (!formData[previewField.name]) return null

                const finalPrompt = (previewField.aiPreview?.promptTemplate || "Generate an image about: {value}").replace(/{value}/g, formData[previewField.name])
                const url = publicPromptImageUrl(finalPrompt, 512, record?.site_id)
                
                return (
                  <div key={previewField.id}>
                    <h4 className="text-[11px] font-medium text-muted-foreground mb-2">{previewField.name}</h4>
                    <div className="w-full rounded-lg overflow-hidden relative group shadow-sm border border-border/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={url} 
                        alt={previewField.name} 
                        className="w-full h-auto object-cover min-h-[120px] bg-muted/20" 
                        onError={showImagePlaceholder}
                      />
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-medium transition-opacity backdrop-blur-sm"
                      >
                        <span>Full Size</span>
                        <span className="text-[10px] mt-1 font-normal opacity-80 max-w-[90%] truncate px-2 text-center">{formData[previewField.name]}</span>
                      </a>
                      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">
                        Current
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        </section>
      )}
    </>
  )
}
