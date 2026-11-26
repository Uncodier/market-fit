import { useLayoutEffect, useMemo, useState } from "react"
import { AgentChannelsTab } from "@/app/components/agents/agent-channels-tab"
import { AgentConnectorsTab } from "@/app/components/agents/agent-connectors-tab"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { SearchInput } from "@/app/components/ui/search-input"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { useLocalization } from "@/app/context/LocalizationContext"
import { EditorActivitiesTab } from "./editor-activities-tab"
import { EditorBasicTab } from "./editor-basic-tab"
import { EditorContextTab } from "./editor-context-tab"
import type { EditorProfile } from "./editor-profile"
import { useEditorSave } from "./use-editor-save"

type Props = { siteId: string; routeId: string; initialProfile: EditorProfile; initialTab?: "basic" | "connectors" }

export function AgentEditor({ siteId, routeId, initialProfile, initialTab = "basic" }: Props) {
  const [profile, setProfile] = useState(initialProfile)
  const [activeTab, setActiveTab] = useState<string>(initialProfile.persistedId ? initialTab : "basic")
  const [queries, setQueries] = useState({ context: "", activities: "" })
  const { t } = useLocalization()
  const { save, saving, disabled } = useEditorSave(siteId, routeId, profile)
  const update = (patch: Partial<EditorProfile>) => setProfile((previous) => ({ ...previous, ...patch }))
  const persistedId = initialProfile.persistedId
  const blank = routeId === "new"
  const tabs = useMemo(() => [
    { value: "basic", label: "Basic Information" },
    ...(blank ? [] : [{ value: "context", label: "Context Files" }, { value: "activities", label: "Activities" }]),
    ...(persistedId ? [
      { value: "channels", label: t("settings.agentChannels.tab") },
      { value: "connectors", label: t("connectors.title") },
    ] : []),
  ], [blank, persistedId, t])

  const title = blank ? t("newAgent") : profile.name || "Agent"
  useLayoutEffect(() => {
    const path = window.location.pathname
    document.title = `${title} | Agents`
    const breadcrumb = (label: string) => window.dispatchEvent(new CustomEvent("breadcrumb:update", { detail: { title: label, path } }))
    breadcrumb(title)
    return () => {
      document.title = "Agents | Market Fit"
      breadcrumb("")
    }
  }, [title])

  return <div className="min-w-0 flex-1 p-0">
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
      <StickyHeader>
        <div className="flex items-center w-full min-w-0 gap-2 md:gap-8 md:px-16">
          <ResponsiveTabsList tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} containerClassName="min-w-0 flex-1" />
          {(activeTab === "context" || activeTab === "activities") && <SearchInput key={activeTab}
            placeholder={activeTab === "context" ? "Search context files..." : "Search activities..."}
            value={queries[activeTab]} onSearch={(query) => setQueries((prev) => ({ ...prev, [activeTab]: query }))}
            containerClassName="w-36 sm:w-56" />}
        </div>
      </StickyHeader>
      <div className="px-4 md:px-16 py-8 pb-16 max-w-[880px] mx-auto">
        <EditorBasicTab siteId={siteId} profile={profile} blank={blank} update={update} save={save} saving={saving} disabled={disabled} />
        {!blank && <>
          <EditorContextTab siteId={siteId} agentId={persistedId} files={profile.contextFiles} search={queries.context}
            onChange={(contextFiles) => update({ contextFiles })} />
          <EditorActivitiesTab activities={profile.activities} search={queries.activities} saving={saving}
            onChange={(activities) => update({ activities })} onSave={() => save("activities")} />
        </>}
        {persistedId && <TabsContent value="channels" className="min-w-0">
          {activeTab === "channels" && <AgentChannelsTab siteId={siteId} agentId={persistedId} />}
        </TabsContent>}
        {persistedId && <TabsContent value="connectors" className="min-w-0">
          {activeTab === "connectors" && <AgentConnectorsTab siteId={siteId} agentId={persistedId} showDetailsLink />}
        </TabsContent>}
      </div>
    </Tabs>
  </div>
}