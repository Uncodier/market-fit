"use client"

import { SkillsSection } from "@/app/components/settings/SkillsSection"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { useLocalization } from "@/app/context/LocalizationContext"

function getSkillsQuickNavSections(t: (key: string) => string): QuickNavSection[] {
  return [
    {
      id: "skills",
      title: t("settings.nav.skills") || "Code agent skills",
      children: [
        { id: "skill-frontend-blog-seo", title: "Frontend Blog & SEO" },
        { id: "skill-makinari", title: "Makinari MCP" },
      ],
    },
  ]
}

export default function SkillsPage() {
  const { t } = useLocalization()
  return (
    <div className="flex-1">
      <div className="py-8 pb-16">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-16">
            <SkillsSection active={true} />
          </div>
          <QuickNav sections={getSkillsQuickNavSections(t)} />
        </div>
      </div>
    </div>
  )
}
