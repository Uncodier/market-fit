"use client"

import dynamic from "next/dynamic"
import type { GraphData, GraphNode } from "./records-graph-model"
import type { RecordsGraphApi } from "./records-graph-inner"

const RecordsGraphInner = dynamic(
  () => import("./records-graph-inner").then((mod) => mod.RecordsGraphInner),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        Loading graph...
      </div>
    ),
  }
)

interface RecordsGraphCanvasProps {
  graphData: GraphData
  onNodeClick?: (node: GraphNode) => void
  onReady?: (api: RecordsGraphApi) => void
}

export function RecordsGraphCanvas({ graphData, onNodeClick, onReady }: RecordsGraphCanvasProps) {
  return (
    <div className="absolute inset-0">
      <RecordsGraphInner graphData={graphData} onNodeClick={onNodeClick} onReady={onReady} />
    </div>
  )
}
