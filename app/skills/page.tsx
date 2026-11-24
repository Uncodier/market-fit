"use client"

import { useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { CommunitySkillsBrowser } from "@/app/components/settings/CommunitySkillsBrowser"
import { SkillsLoading } from "@/app/components/settings/skills-loading"
import { SkillDialog, type SkillDialogAction } from "@/app/components/settings/SkillDialog"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { BookOpen, Plus, Search, Settings } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"

type SkillsTab = "manage" | "browse" | "makinari-skills"

// Browse is the default. Load the editor list and built-in guides (including
// MCP setup) only when their Radix tab content is mounted.
const SkillManager = dynamic(() => import("@/app/components/settings/SkillManager").then(m => m.SkillManager), {
  loading: () => <SkillsLoading kind="managed" />,
})
const SystemSkillsCatalog = dynamic(() => import("@/app/components/settings/SystemSkillsCatalog").then(m => m.SystemSkillsCatalog), {
  loading: () => <SkillsLoading kind="system" />,
})
const SkillsSection = dynamic(() => import("@/app/components/settings/SkillsSection").then(m => m.SkillsSection))

function isSkillsTab(value: string | null): value is SkillsTab {
  return value === "manage" || value === "browse" || value === "makinari-skills"
}

export default function SkillsPage() {
  const { currentSite, isLoading } = useSite()
  const requestedTab = useSearchParams().get('tab')
  if (isLoading) return <SkillsLoading kind={requestedTab === 'manage' ? 'managed' : requestedTab === 'makinari-skills' ? 'system' : 'community'} />
  return <SkillsWorkspace key={currentSite?.id} siteId={currentSite?.id} requestedTab={requestedTab} />
}

function SkillsWorkspace({ siteId, requestedTab }: { siteId?: string; requestedTab: string | null }) {
  const { t } = useLocalization()
  const router = useRouter()
  const urlTab = isSkillsTab(requestedTab) ? requestedTab : "browse"
  const [selection, setSelection] = useState({ requestedTab, tab: urlTab })
  const tab = selection.requestedTab === requestedTab ? selection.tab : urlTab
  if (selection.requestedTab !== requestedTab) setSelection({ requestedTab, tab: urlTab })
  const [action, setAction] = useState<SkillDialogAction | null>(null)
  const [revision, setRevision] = useState(0)
  const [searchTarget, setSearchTarget] = useState<HTMLDivElement | null>(null)
  const [systemSkillSections, setSystemSkillSections] = useState<QuickNavSection[]>([
    { id: "current-skills", title: "Current skills" },
  ])
  const updateSystemSkillSections = useCallback((next: QuickNavSection[]) => setSystemSkillSections(next), [])

  const sections: Record<SkillsTab, QuickNavSection[]> = {
    manage: [],
    browse: [
      { id: "community-skills", title: "Browse community skills" },
      { id: "community-results", title: "Community skills" },
    ],
    "makinari-skills": [
      ...systemSkillSections,
      {
        id: "skills",
        title: t("settings.nav.skills") || "MAKINARI Skills",
        children: [
          { id: "skill-frontend-blog-seo", title: "Frontend Blog & SEO" },
          { id: "skill-makinari", title: "MAKINARI MCP" },
        ],
      },
    ],
  }

  const changeTab = (value: string) => {
    if (!isSkillsTab(value)) return
    setSelection({ requestedTab, tab: value })
    router.replace(`/skills?tab=${value}`, { scroll: false })
  }

  return (
    <div className="flex-1">
      <SkillDialog siteId={siteId} action={action} onActionChange={setAction}
        onSaved={() => setRevision(current => current + 1)}
        renderTrigger={trigger => <TopBarPrimaryActions>{trigger}</TopBarPrimaryActions>}
        trigger={<Button aria-label="Add skill" title="Add skill" disabled={!siteId}
          className="!size-9 !p-0 sm:!w-auto sm:!px-4">
          <Plus size={16} /><span className="hidden sm:inline">Add skill</span>
        </Button>} />
      <Tabs value={tab} onValueChange={changeTab}>
        <StickyHeader>
          <div className="flex w-full flex-wrap items-center gap-3 py-3">
            <TabsList className="h-8 w-auto rounded-full bg-muted/30 p-0.5">
              <TabsTrigger value="manage" className="rounded-full px-2 text-xs sm:px-4">
                <Settings className="h-4 w-4" /> Manage
              </TabsTrigger>
              <TabsTrigger value="browse" className="rounded-full px-2 text-xs sm:px-4">
                <Search className="h-4 w-4" /> Browse
              </TabsTrigger>
              <TabsTrigger value="makinari-skills" className="rounded-full px-2 text-xs sm:px-4">
                <BookOpen className="h-4 w-4" /> Makinari Skills
              </TabsTrigger>
            </TabsList>
            {tab !== "manage" && <div ref={setSearchTarget} className="contents" />}
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="mx-auto flex max-w-[1200px] justify-center gap-8">
            <div className="max-w-[880px] min-w-0 flex-1 px-4 md:px-16">
              <TabsContent value="manage"><SkillManager revision={revision} onEdit={skill => setAction({ type: "edit", skill })} /></TabsContent>
              <TabsContent value="browse"><CommunitySkillsBrowser searchTarget={searchTarget}
                onImport={url => setAction({ type: "import", url })} /></TabsContent>
              <TabsContent value="makinari-skills" className="space-y-6">
                <SystemSkillsCatalog searchTarget={searchTarget} onSectionsChange={updateSystemSkillSections} />
                <SkillsSection active={true} />
              </TabsContent>
            </div>
            {sections[tab].length > 0 && <QuickNav sections={sections[tab]} />}
          </div>
        </div>
      </Tabs>
    </div>
  )
}
