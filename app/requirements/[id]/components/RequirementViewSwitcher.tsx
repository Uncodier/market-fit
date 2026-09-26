"use client"

import { useState, type ReactNode } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

export type RequirementView = "document" | "nodes"

type RequirementViewSwitcherProps = {
  activeView: RequirementView
  onViewChange: (view: RequirementView) => void
  documentView: ReactNode
  children: ReactNode
}

export function RequirementViewSwitcher({
  activeView,
  onViewChange,
  documentView,
  children,
}: RequirementViewSwitcherProps) {
  const [hasOpenedDiagram, setHasOpenedDiagram] = useState(false)

  return (
    <div className="relative min-h-0 flex-1">
      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
        <Tabs value={activeView} onValueChange={(value) => {
          if (value === "nodes") {
            setHasOpenedDiagram(true)
            onViewChange("nodes")
          } else if (value === "document") {
            onViewChange("document")
          }
        }}>
          <TabsList className="pointer-events-auto grid w-[220px] grid-cols-2 border border-border/40 bg-background/35 shadow-sm backdrop-blur-md">
            <TabsTrigger value="document" className="data-[state=active]:bg-background/75">Document</TabsTrigger>
            <TabsTrigger value="nodes" className="data-[state=active]:bg-background/75">Diagram</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div hidden={activeView !== "document"} className={activeView === "document" ? "h-full overflow-y-auto pt-14" : "hidden"}>
        {documentView}
      </div>
      <div hidden={activeView !== "nodes"} className={activeView === "nodes" ? "h-full overflow-hidden" : "hidden"}>
        {hasOpenedDiagram && children}
      </div>
    </div>
  )
}