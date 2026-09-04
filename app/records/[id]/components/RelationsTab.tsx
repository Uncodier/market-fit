import React, { useEffect, useState, useMemo } from "react"
import { LinkIcon, FileText, Waypoints, ExternalLink } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { getVectorRelatedRecords, resolveEntityPreviews, getRecordById, type EntityPreview } from "../../actions"
import Link from "next/link"
import { Skeleton } from "@/app/components/ui/skeleton"
import { RecordsGraphCanvas } from "../../components/records-graph-canvas"
import { buildGraphData } from "../../components/records-graph-model"
import { useRouter } from "next/navigation"

interface RelationsTabProps {
  fields: any[]
  relationsData: Record<string, any>
  recordId: string
}

export function RelationsTab({ recordId, fields, relationsData }: RelationsTabProps) {
  const router = useRouter()
  const [relatedRecords, setRelatedRecords] = useState<any[]>([])
  const [currentRecord, setCurrentRecord] = useState<any>(null)
  const [resolvedRelations, setResolvedRelations] = useState<Record<string, string>>({})
  const [entityPreviews, setEntityPreviews] = useState<Record<string, EntityPreview>>({})
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (recordId) {
      loadData()
    }
  }, [recordId, relationsData]) // reload if relations data changes in the form

  const loadData = async () => {
    setIsLoading(true)
    
    // 1. Fetch related vector records & current record details
    const [vectorRes, recordRes] = await Promise.all([
      getVectorRelatedRecords(recordId, 0.72, 10), // tighter threshold for graph
      getRecordById(recordId)
    ])
    
    if (!vectorRes.error && vectorRes.records) {
      setRelatedRecords(vectorRes.records)
    } else {
      setRelatedRecords([])
    }
    
    if (!recordRes.error && recordRes.record) {
      setCurrentRecord({
        ...recordRes.record,
        relations: relationsData || recordRes.record.relations || {}
      })
    }

    if (relationsData && fields) {
      const toResolve = new Map<string, Set<string>>()
      
      Object.entries(relationsData).forEach(([fieldName, targetId]) => {
        if (!targetId || typeof targetId !== 'string') return
        const fieldDef = fields.find(f => f.name === fieldName)
        if (!fieldDef) return
        
        const target = fieldDef.relationTarget || 'lead'
        
        if (!toResolve.has(target)) toResolve.set(target, new Set())
        toResolve.get(target)!.add(targetId)
      })
      
      const payload = Array.from(toResolve.entries()).map(([target, ids]) => ({
        target,
        ids: Array.from(ids)
      }))
      
      if (payload.length > 0) {
        const previews = await resolveEntityPreviews(payload)
        setEntityPreviews(previews)
        const labels: Record<string, string> = {}
        Object.entries(previews).forEach(([id, preview]) => {
          labels[id] = preview.label
        })
        setResolvedRelations(labels)
      } else {
        setResolvedRelations({})
        setEntityPreviews({})
      }
    } else {
      setResolvedRelations({})
      setEntityPreviews({})
    }
    
    setIsLoading(false)
  }

  // 3. Build graph data for local graph
  const graphData = useMemo(() => {
    if (!currentRecord) return { nodes: [], links: [] }

    // Mock an array of records that includes the current one and the similar ones
    // For the similar ones, we don't have all their data, but we have enough for the node
    const recordsForGraph = [{
      ...currentRecord,
      relations: relationsData || currentRecord.relations || {},
      category: {
        ...currentRecord.category,
        template_fields: fields?.length
          ? fields
          : currentRecord.category?.template_fields || []
      }
    }, ...relatedRecords.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: { name: r.category_name }
    }))]

    // Create mock similarity edges
    const similarityEdges = relatedRecords.map(r => ({
      source_id: recordId,
      target_id: r.id,
      similarity: r.similarity
    }))

    return buildGraphData(recordsForGraph, similarityEdges, resolvedRelations, {
      showRelations: true,
      showSimilarity: true,
      showEntities: true,
      similarityThreshold: 0,
      currentRecordId: recordId,
      entityPreviews,
    })
  }, [currentRecord, relatedRecords, resolvedRelations, recordId, relationsData, fields, entityPreviews])

  // Explicit relations list for UI
  const explicitRelationsList = useMemo(() => {
    if (!relationsData || !fields) return []
    
    const list: any[] = []
    Object.entries(relationsData).forEach(([fieldName, targetId]) => {
      if (!targetId || typeof targetId !== 'string') return
      const fieldDef = fields.find(f => f.name === fieldName)
      if (!fieldDef) return
      
      const target = fieldDef.relationTarget || 'lead'
      const label = resolvedRelations[targetId] || `${target} (${targetId.substring(0, 8)})`
      
      list.push({
        id: targetId,
        fieldName,
        target,
        label,
        isRecord: target === 'record'
      })
    })
    
    return list
  }, [relationsData, fields, resolvedRelations])

  return (
    <div className="space-y-6">
      
      {/* 1. Local Graph View */}
      <div className="rounded-lg border border-border bg-background overflow-hidden h-[300px] relative">
        {isLoading && !currentRecord ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
            <Skeleton className="w-16 h-16 rounded-full opacity-50" />
          </div>
        ) : graphData.nodes.length <= 1 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 p-4 text-center">
            <Waypoints className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm">No connections</p>
            <p className="text-xs mt-1">Add relation fields or save to generate semantic matches.</p>
          </div>
        ) : (
          <RecordsGraphCanvas 
            graphData={graphData} 
            onNodeClick={(node) => {
              if (node.type === 'record' && node.id !== recordId) {
                router.push(`/records/${node.id}`)
              }
            }}
          />
        )}
      </div>

      <div className="space-y-4">
        {/* 2. Explicit Relations */}
        {explicitRelationsList.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Explicit Relations
            </h4>
            {explicitRelationsList.map(rel => (
              rel.isRecord ? (
                <Link key={rel.id} href={`/records/${rel.id}`}>
                  <div className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between group hover:bg-muted/40 transition-colors mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{rel.label}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {rel.fieldName} • Record
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </Link>
              ) : (
                <div key={rel.id} className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center text-muted-foreground">
                      <ExternalLink className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{rel.label}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {rel.fieldName} • {rel.target.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* 3. Semantic Matches */}
        <div className="space-y-3 pt-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Waypoints className="h-4 w-4" />
            Semantic Similar
          </h4>
          
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32 rounded-md" />
                      <Skeleton className="h-3 w-24 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : relatedRecords.length > 0 ? (
            <div className="space-y-3">
              {relatedRecords.map(rel => (
                <Link key={rel.id} href={`/records/${rel.id}`}>
                  <div className="p-3 border border-border/50 bg-muted/20 rounded-lg flex items-center justify-between group hover:bg-muted/40 transition-colors mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-background border flex items-center justify-center text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{rel.title || 'Untitled'}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {rel.category_name || 'Record'} • {Math.round(rel.similarity * 100)}% match
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center p-6 text-muted-foreground text-sm border border-dashed rounded-lg bg-muted/10">
              No semantic matches found above threshold.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}