"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { Card } from "@/app/components/ui/card"
import { ArrowLeft } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { useRouter } from "next/navigation"
import { NAVIGATION_AREAS, WorkspaceArea, AreaNavItem } from "@/app/config/navigation-areas"

export default function NavigationPage() {
  const { t } = useLocalization()
  const router = useRouter()

  const AREA_EMOJI: Record<WorkspaceArea, string> = {
    marketing: "📣",
    sales: "🤝",
    automation: "⚡",
    applications: "📱",
    reports: "📑",
  }

  const NAV_ITEM_EMOJI: Record<string, string> = {
    salesHome: "🏠",
    campaigns: "🎯",
    segments: "🏷️",
    content: "📄",
    contentCreator: "🖨️",
    assets: "📁",
    context: "🏢",
    agentsConfiguration: "✨",
    applicationsDatabase: "💾",
    applicationsRepositories: "📦",
    sales: "💰",
    leads: "👥",
    deals: "🤝",
    chat: "💬",
    people: "🔍",
    controlCenter: "🚀",
    requirements: "✅",
    channels: "📡",
    activities: "📋",
    skills: "🧩",
    reportPerformance: "📈",
    reportOverview: "📋",
    reportAnalytics: "🔎",
    reportTraffic: "🌐",
    reportCosts: "📊",
    reportSales: "💵",
  }

  const buildHref = (item: AreaNavItem) => {
    if (item.dashboardTab) return `/dashboard?tab=${item.dashboardTab}`
    if (item.settingsTab) return `/settings?tab=${item.settingsTab}`
    if (item.robotsMode) return `/robots?mode=${item.robotsMode}`
    return item.href
  }

  const getTitle = (item: AreaNavItem) => {
    if (item.dashboardTab) {
      const translation = t(`dashboard.tabs.${item.dashboardTab}`)
      return translation === `dashboard.tabs.${item.dashboardTab}` ? item.dashboardTab : translation
    }
    if (item.settingsTab === "channels") {
      const translation = t("settings.tabs.channels")
      return translation === "settings.tabs.channels" ? "Agent Channels" : translation
    }
    if (item.settingsTab === "activities") {
      const translation = t("settings.tabs.activities")
      return translation === "settings.tabs.activities" ? "Activities" : translation
    }
    if (item.key === "skills") {
      const translation = t("settings.tabs.skills")
      return translation === "settings.tabs.skills" ? "Code agent skills" : translation
    }
    if (item.key === "reportCosts") {
      const translation = t("layout.sidebar.costs")
      return translation === "layout.sidebar.costs" ? "Cost reports" : translation
    }
    if (item.key === "contentCreator") {
      const translation = t("layout.sidebar.imprenta")
      return translation === "layout.sidebar.imprenta" ? "Content Creator" : translation
    }
    const translation = t(`layout.sidebar.${item.key}`)
    return translation === `layout.sidebar.${item.key}` ? item.key : translation
  }

  // Define the order of sections to render
  const sectionsOrder: WorkspaceArea[] = ["marketing", "sales", "automation", "applications", "reports"]

  return (
    <div className="flex-1 min-w-0 w-full flex flex-col min-h-[100dvh] bg-muted/30">
      <div className="flex-none p-8 pb-0 max-w-[1200px] w-full mx-auto">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.back()}
          className="gap-2 text-muted-foreground hover:text-foreground -ml-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back") === "common.back" ? "Back" : t("common.back")}
        </Button>
      </div>
      <div className="flex-1 p-8 flex flex-col items-center">
        <div className="flex flex-col gap-12 max-w-[1200px] w-full pb-12">
          {sectionsOrder.map((areaKey) => {
            const area = NAVIGATION_AREAS[areaKey]
            const items = area.items.filter(item => !item.hidden)
            if (items.length === 0) return null

            const categoryTitle = t(area.categoryKey) === area.categoryKey ? areaKey : t(area.categoryKey)

            return (
              <div key={areaKey} className="flex flex-col gap-6">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-xl">{AREA_EMOJI[areaKey]}</span>
                  <h2 className="text-lg font-semibold text-foreground capitalize">{categoryTitle}</h2>
                </div>
                <div className="flex flex-wrap gap-8">
                  {items.map((item) => (
                    <div 
                      key={item.key} 
                      onClick={() => router.push(buildHref(item))} 
                      className="flex flex-col items-center gap-3 group outline-none w-[100px] cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(buildHref(item))
                        }
                      }}
                    >
                      <Card
                        className="flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:border-primary/30 transition-all duration-200 w-16 h-16 rounded-xl"
                      >
                        <div className="flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                          <span className="text-3xl leading-none">
                            {NAV_ITEM_EMOJI[item.key] || "📦"}
                          </span>
                        </div>
                      </Card>
                      <div className="text-[11px] font-medium text-center text-muted-foreground group-hover:text-foreground transition-colors leading-tight line-clamp-2 w-full px-1">
                        {getTitle(item)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
