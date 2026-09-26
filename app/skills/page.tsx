"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SkillManager } from "@/app/components/settings/SkillManager"
import { CommunitySkillsBrowser } from "@/app/components/settings/CommunitySkillsBrowser"
import { SkillsSection } from "@/app/components/settings/SkillsSection"
import { SystemSkillsCatalog } from "@/app/components/settings/SystemSkillsCatalog"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { BookOpen, Search, Settings } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

type SkillsTab = "manage" | "browse" | "makinari-skills"

function isSkillsTab(value: string | null): value is SkillsTab {
  return value === "manage" || value === "browse" || value === "makinari-skills"
}

export default function SkillsPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const params = useSearchParams()
  const requestedTab = params.get("tab")
  const [tab, setTab] = useState<SkillsTab>(isSkillsTab(requestedTab) ? requestedTab : "manage")
  const [systemSkillSections, setSystemSkillSections] = useState<QuickNavSection[]>([
    { id: "current-skills", title: "Current skills" },
  ])
  const updateSystemSkillSections = useCallback((next: QuickNavSection[]) => setSystemSkillSections(next), [])

  useEffect(() => {
    setTab(isSkillsTab(requestedTab) ? requestedTab : "manage")
  }, [requestedTab])

  const sections: Record<SkillsTab, QuickNavSection[]> = {
    manage: [{ id: "skill-editor", title: "Upload or edit" }, { id: "site-skills", title: "Your skills" }],
    browse: [
      { id: "community-skills", title: "Search skills" },
      { id: "community-results", title: "Search results" },
      { id: "community-import", title: "Import from URL" },
    ],
    "makinari-skills": [
      ...systemSkillSections,
      {
        id: "skills",
        title: t("settings.nav.skills") || "Makinari Skills",
        children: [
          { id: "skill-frontend-blog-seo", title: "Frontend Blog & SEO" },
          { id: "skill-makinari", title: "Makinari MCP" },
        ],
      },
    ],
  }

  const changeTab = (value: string) => {
    if (!isSkillsTab(value)) return
    setTab(value)
    router.replace(`/skills?tab=${value}`, { scroll: false })
  }

  return (
    <div className="flex-1">
      <Tabs value={tab} onValueChange={changeTab}>
        <StickyHeader>
          <div className="flex w-full items-center justify-between px-4 md:px-16">
            <TabsList className="h-8 w-auto rounded-full bg-muted/30 p-0.5">
              <TabsTrigger value="manage" className="rounded-full px-4 text-xs">
                <Settings className="h-4 w-4" /> Manage
              </TabsTrigger>
              <TabsTrigger value="browse" className="rounded-full px-4 text-xs">
                <Search className="h-4 w-4" /> Browse
              </TabsTrigger>
              <TabsTrigger value="makinari-skills" className="rounded-full px-4 text-xs">
                <BookOpen className="h-4 w-4" /> Makinari Skills
              </TabsTrigger>
            </TabsList>
          </div>
        </StickyHeader>
        <div className="py-8 pb-16">
          <div className="mx-auto flex max-w-[1200px] justify-center gap-8">
            <div className="max-w-[880px] min-w-0 flex-1 px-4 md:px-16">
              <TabsContent value="manage"><SkillManager /></TabsContent>
              <TabsContent value="browse"><CommunitySkillsBrowser /></TabsContent>
              <TabsContent value="makinari-skills" className="space-y-6">
                <SystemSkillsCatalog onSectionsChange={updateSystemSkillSections} />
                <SkillsSection active={true} />
              </TabsContent>
            </div>
            <QuickNav sections={sections[tab]} />
          </div>
        </div>
      </Tabs>
    </div>
  )
}
