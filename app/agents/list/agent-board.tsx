import { useMemo } from "react"
import { ZoomableCanvas } from "@/app/components/agents/zoomable-canvas"
import { AnimatedConnectionLine } from "@/app/components/agents/animated-connection-line"
import { SimpleAgentCard } from "@/app/components/agents/simple-agent-card"
import { AgentBoardSkeleton } from "@/app/components/agents/skeleton-components"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import { projectAgentHierarchy, reportingLabel, type HierarchyNode } from "./agent-hierarchy"
import type { AgentListViewProps } from "./use-agent-list-actions"

type BranchProps = Pick<AgentListViewProps, "card" | "isExpanded"> & {
  node: HierarchyNode
  duplicateNames: ReadonlySet<string>
}

function AgentBranch({ node, duplicateNames, card, isExpanded }: BranchProps) {
  const { t } = useLocalization()
  const { agent, line, children } = node
  return <li className="relative flex flex-col items-center" data-agent-id={agent.id}>
    {line.kind === "reportsTo" && <div aria-hidden="true" data-supervisor-id={line.supervisor.id} className="relative h-8 w-px bg-border">
      <AnimatedConnectionLine direction="down" className="motion-reduce:hidden" />
    </div>}
    <div className="w-[512px] px-14 text-center">
      <p className="mb-2 text-xs text-muted-foreground">{reportingLabel(line, duplicateNames, t)}</p>
      {node.duplicateName && <p className="mb-2 font-mono text-xs text-muted-foreground">{agent.id}</p>}
      <SimpleAgentCard {...card} className="text-left" agent={agent} showActivities={isExpanded(agent)} />
    </div>
    {children.length > 0 && <>
      <div aria-hidden="true" className="h-8 w-px bg-border" />
      <ul className={cn("flex items-start", children.length > 1 &&
        "[&>li]:before:absolute [&>li]:before:inset-x-0 [&>li]:before:top-0 [&>li]:before:border-t [&>li:first-child]:before:left-1/2 [&>li:last-child]:before:right-1/2")}>
        {children.map(child => <AgentBranch key={child.agent.id} node={child} duplicateNames={duplicateNames} card={card} isExpanded={isExpanded} />)}
      </ul>
    </>}
  </li>
}

export function AgentBoard({ agents, query, isLoading, card, isExpanded }: AgentListViewProps) {
  const { t } = useLocalization()
  const { roots, templates, duplicateNames } = useMemo(() => projectAgentHierarchy(agents, query), [agents, query])
  if (isLoading) return <AgentBoardSkeleton />
  if (!roots.length && !templates.length) return <p className="p-8 text-center text-muted-foreground">{t("agents.grid.empty.title")}</p>
  return <ZoomableCanvas>
    <div className="mx-auto flex w-max flex-col items-center gap-12 py-8">
      {roots.length > 0 && <section aria-labelledby="agent-hierarchy-title">
        <h2 id="agent-hierarchy-title" className="mb-8 text-center text-2xl font-bold">{t("agents.hierarchy.title")}</h2>
        <ul className="grid items-start justify-center gap-y-12" style={{ gridTemplateColumns: `repeat(${Math.min(3, roots.length)}, max-content)` }}>
          {roots.map(node => <AgentBranch key={node.agent.id} node={node} duplicateNames={duplicateNames} card={card} isExpanded={isExpanded} />)}
        </ul>
      </section>}
      {templates.length > 0 && <section aria-labelledby="agent-templates-title" className="rounded-xl border border-dashed p-6">
        <h2 id="agent-templates-title" className="mb-5 text-center text-xl font-semibold">{t("agents.hierarchy.setupTemplates")}</h2>
        <ul className="grid items-start gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(3, templates.length)}, 400px)` }}>
          {templates.map(agent => <li key={agent.id}><SimpleAgentCard {...card} agent={agent} showActivities={isExpanded(agent)} /></li>)}
        </ul>
      </section>}
    </div>
  </ZoomableCanvas>
}