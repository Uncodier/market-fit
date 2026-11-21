"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { AgentSelectionContext } from "@/app/components/agents/agent-selection-context"
import { AgentToolsPanel } from "@/app/components/agents/agent-tools-panel"
import { CommandsPanel } from "@/app/components/agents/commands-panel"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Button } from "@/app/components/ui/button"
import { List, Plus, TableRows } from "@/app/components/ui/icons"
import { SearchInput } from "@/app/components/ui/search-input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useCommandK } from "@/app/hooks/use-command-k"
import { AgentBoard } from "./list/agent-board"
import { AgentDirectorySkeleton } from "@/app/components/agents/skeleton-components"
import { AgentTable } from "./list/agent-table"
import { useAgentList } from "./list/use-agent-list"
import { useAgentListActions } from "./list/use-agent-list-actions"

type Tab = "agents" | "commands" | "tools"
function AgentDirectory({ siteId, userId, url }: { siteId?: string; userId?: string; url?: string | null }) {
  const { t } = useLocalization()
  const [mainTab, setMainTab] = useState<Tab>("agents")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<"hierarchy" | "grid">("hierarchy")
  const { agents, isLoading, error, reload } = useAgentList(siteId, userId)
  const { selection, ...actions } = useAgentListActions(siteId, userId, url)
  useCommandK()
  const DirectoryView = view === "hierarchy" ? AgentBoard : AgentTable
  const createLabel = t("settings.agentChannels.createAgent")

  return <AgentSelectionContext.Provider value={selection}>
    {mainTab === "agents" && <TopBarPrimaryActions>
      <Button asChild size="sm" data-permission="insert" data-toolbar-icon-action="off" aria-label={createLabel}>
        <Link href="/agents/new"><Plus className="h-4 w-4 shrink-0" /><span className="ml-2">{createLabel}</span></Link>
      </Button>
    </TopBarPrimaryActions>}
    <div className="flex h-full relative bg-background">
      <div className="flex-1 w-full min-w-0 space-y-4" style={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}>
        <StickyHeader>
          <div className="flex flex-wrap items-center gap-4 w-full">
            <Tabs value={mainTab} onValueChange={value => setMainTab(value as Tab)}>
              <TabsList className="h-9">
                <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
                <TabsTrigger value="commands" className="text-xs">Commands</TabsTrigger>
                <TabsTrigger value="tools" className="text-xs">Agent Tools</TabsTrigger>
              </TabsList>
            </Tabs>
            {mainTab === "agents" && <>
              <SearchInput data-command-k-input placeholder="Search team..." value={query} onChange={e => setQuery(e.target.value)} />
              <div className="ml-auto flex items-center gap-3">
                <ToggleGroup type="single" value={view} onValueChange={v => { if (v === "hierarchy" || v === "grid") setView(v) }}>
                  <ToggleGroupItem value="hierarchy" aria-label="Toggle hierarchy view" className="px-2"><TableRows className="h-4 w-4" /></ToggleGroupItem>
                  <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-2"><List className="h-4 w-4" /></ToggleGroupItem>
                </ToggleGroup>
              </div>
            </>}
          </div>
        </StickyHeader>
        {mainTab === "commands" ? <CommandsPanel /> : mainTab === "tools" ? <AgentToolsPanel /> : error ? (
          <div role="alert" className="p-8 text-center">
            {t("settings.agentChannels.listError")} <Button variant="outline" size="sm" onClick={reload}>{t("system.error.retry")}</Button>
          </div>
        ) : <div className={view === "grid" ? "px-4 lg:px-8 py-4 my-4" : "py-4"}>
          <DirectoryView agents={agents} query={query} isLoading={isLoading} {...actions} />
        </div>}
      </div>
    </div>
  </AgentSelectionContext.Provider>
}

export default function AgentsPage() {
  const { currentSite, isLoading } = useSite()
  const { user, isLoading: authLoading } = useAuthContext()
  const { t } = useLocalization()
  if ((!currentSite && isLoading) || (!user && authLoading)) return <AgentDirectorySkeleton />
  if (!user) return <p className="p-8 text-center text-muted-foreground">{t("auth.workspace.signInDesc")}</p>
  if (!currentSite) return <p className="p-8 text-center text-muted-foreground">{t("settings.empty.noSite")}</p>
  return <Suspense fallback={<AgentDirectorySkeleton />}>
    <AgentDirectory key={`${currentSite.id}:${user.id}`} siteId={currentSite.id} userId={user.id} url={currentSite.url} />
  </Suspense>
}