"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { RecordsGraphCanvas } from "./records-graph-canvas"
import { buildGraphData } from "./records-graph-model"
import type { RecordsGraphApi } from "./records-graph-inner"
import { Slider } from "@/app/components/ui/slider"
import { Button } from "@/app/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { Loader, ZoomIn, ZoomOut, Maximize, Link, Users, Waypoints } from "@/app/components/ui/icons"
import { getRecordsSimilarityEdges, resolveEntityPreviews, type EntityPreview } from "../actions"
import { useSite } from "@/app/context/SiteContext"
import { useTheme } from "@/app/context/ThemeContext"
import { cn } from "@/lib/utils"

export function RecordsGraph({
  records,
  toolsOffsetLeft = 92,
}: {
  records: any[]
  toolsOffsetLeft?: number
}) {
  const { currentSite } = useSite()
  const { isDarkMode } = useTheme()
  const router = useRouter()
  const graphApiRef = useRef<RecordsGraphApi | null>(null)

  const [similarityThreshold, setSimilarityThreshold] = useState(0.55)
  const [showRelations, setShowRelations] = useState(true)
  const [showSimilarity, setShowSimilarity] = useState(true)
  const [showEntities, setShowEntities] = useState(true)
  const [similarityEdges, setSimilarityEdges] = useState<any[]>([])
  const [resolvedRelations, setResolvedRelations] = useState<Record<string, string>>({})
  const [entityPreviews, setEntityPreviews] = useState<Record<string, EntityPreview>>({})
  const [isLoading, setIsLoading] = useState(false)

  const handleReady = useCallback((api: RecordsGraphApi) => {
    graphApiRef.current = api
  }, [])

  useEffect(() => {
    if (!currentSite?.id || !showSimilarity) return

    let isMounted = true
    const timeoutId = setTimeout(async () => {
      setIsLoading(true)
      const { edges } = await getRecordsSimilarityEdges(currentSite.id, similarityThreshold, 10)
      if (isMounted) {
        if (edges) setSimilarityEdges(edges)
        setIsLoading(false)
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timeoutId)
    }
  }, [currentSite?.id, similarityThreshold, showSimilarity])

  useEffect(() => {
    if (!showRelations || records.length === 0) return

    let isMounted = true
    const resolveNames = async () => {
      const toResolve = new Map<string, Set<string>>()

      records.forEach((record) => {
        if (!record.relations || !record.category?.template_fields) return
        const templateFields = record.category.template_fields
        Object.entries(record.relations).forEach(([fieldName, targetId]) => {
          if (!targetId || typeof targetId !== "string") return
          const fieldDef = templateFields.find((f: any) => f.name === fieldName)
          if (!fieldDef) return
          const target = fieldDef.relationTarget || "lead"
          if (!toResolve.has(target)) toResolve.set(target, new Set())
          toResolve.get(target)!.add(targetId)
        })
      })

      const payload = Array.from(toResolve.entries()).map(([target, ids]) => ({
        target,
        ids: Array.from(ids),
      }))

      if (payload.length > 0) {
        const previews = await resolveEntityPreviews(payload)
        if (!isMounted) return
        setEntityPreviews(previews)
        const labels: Record<string, string> = {}
        Object.entries(previews).forEach(([id, preview]) => {
          labels[id] = preview.label
        })
        setResolvedRelations(labels)
      }
    }

    resolveNames()
    return () => {
      isMounted = false
    }
  }, [records, showRelations])

  const graphData = useMemo(() => {
    return buildGraphData(records, similarityEdges, resolvedRelations, {
      showRelations,
      showSimilarity,
      showEntities,
      similarityThreshold,
      entityPreviews,
    })
  }, [records, similarityEdges, resolvedRelations, showRelations, showSimilarity, showEntities, similarityThreshold, entityPreviews])

  const linkCount = graphData.links.length
  const dotColor = isDarkMode ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.07)"

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: "calc(100vh - 135px)",
        minHeight: "600px",
        backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    >
      {graphData.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No records to display.
        </div>
      ) : (
        <RecordsGraphCanvas
          graphData={graphData}
          onReady={handleReady}
          onNodeClick={(node) => {
            if (node.type === "record") router.push(`/records/${node.id}`)
          }}
        />
      )}

      {graphData.nodes.length > 0 && linkCount === 0 && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full border border-black/5 bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow-sm dark:border-white/5">
          No links yet. Add relation fields or save records to generate semantic matches.
        </div>
      )}

      <TooltipProvider delayDuration={200}>
        <div
          className="fixed bottom-8 z-50 flex items-center gap-2 rounded-lg border border-black/5 bg-background/95 p-1.5 shadow-md backdrop-blur-sm dark:border-white/5"
          style={{
            left: `${toolsOffsetLeft}px`,
            transition: "left 0.2s ease-out",
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphApiRef.current?.zoomIn()} aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Zoom in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphApiRef.current?.zoomOut()} aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Zoom out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => graphApiRef.current?.fit()} aria-label="Fit to screen">
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>Fit to screen</TooltipContent>
          </Tooltip>

          <div className="ml-1 flex items-center gap-2 border-l border-border pl-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", showRelations && "bg-muted")}
                  onClick={() => setShowRelations((v) => !v)}
                  aria-label="Toggle relations"
                >
                  <Link className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Relations</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", showEntities && showRelations && "bg-muted")}
                  onClick={() => setShowEntities((v) => !v)}
                  disabled={!showRelations}
                  aria-label="Toggle entities"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>Entities</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-8 w-8", showSimilarity && "bg-muted")}
                  onClick={() => setShowSimilarity((v) => !v)}
                  aria-label="Toggle similarity"
                >
                  {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <Waypoints className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Similar {Math.round(similarityThreshold * 100)}%
              </TooltipContent>
            </Tooltip>
            <div className="flex w-[88px] items-center px-2">
              <Slider
                value={[similarityThreshold * 100]}
                onValueChange={(val) => setSimilarityThreshold(val[0] / 100)}
                min={40}
                max={95}
                step={1}
                disabled={!showSimilarity}
              />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
