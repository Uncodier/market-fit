import { useMemo } from "react"
import { GridAgentRow } from "@/app/components/agents/grid-agent-row"
import { Table, TableBody, TableHeader, TableRow } from "@/app/components/ui/table"
import { GridAgentRowSkeleton } from "@/app/components/agents/skeleton-components"
import { useLocalization } from "@/app/context/LocalizationContext"
import { DocumentListHead, documentListShellClassName } from "@/app/components/documents/document-list"
import { projectAgentHierarchy, reportingLabel } from "./agent-hierarchy"
import type { AgentListViewProps } from "./use-agent-list-actions"

export function AgentTable({ agents, query, isLoading, card, isExpanded }: AgentListViewProps) {
  const { t } = useLocalization()
  const { entries, duplicateNames } = useMemo(() => projectAgentHierarchy(agents, query), [agents, query])
  if (!isLoading && !entries.length) return <p className="text-center p-8 text-muted-foreground">{t("agents.grid.empty.title")}</p>

  return <div className={documentListShellClassName()} role={isLoading ? 'status' : undefined}
    aria-busy={isLoading || undefined} aria-label={isLoading ? t('common.loading') : undefined}>
    <Table className="min-w-[920px]">
      <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <TableRow className="hover:bg-transparent">
          <DocumentListHead className="w-[35%] pl-4 sm:pl-6">Agent</DocumentListHead>
          <DocumentListHead className="w-[12%]">Type</DocumentListHead>
          <DocumentListHead className="w-[15%]">Status</DocumentListHead>
          <DocumentListHead className="w-[15%]">Channels</DocumentListHead>
          <DocumentListHead className="w-[13%]" align="right">Last Active</DocumentListHead>
          <DocumentListHead className="w-[10%] pr-4 sm:pr-6" align="right">Actions</DocumentListHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? Array.from({ length: 4 }, (_, i) => <GridAgentRowSkeleton key={i} />) : entries.map(({ agent, line, duplicateName }) => (
          <GridAgentRow key={agent.id} agent={agent} {...card} showId={duplicateName} reportingLabel={reportingLabel(line, duplicateNames, t)}
            isExpanded={isExpanded(agent)} onToggleExpand={card.onToggleActivities} />
        ))}
      </TableBody>
    </Table>
  </div>
}