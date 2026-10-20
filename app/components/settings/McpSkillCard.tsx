"use client"

import { useState } from "react"
import { useOptionalSite } from "@/app/context/SiteContext"
import { McpAgentSkillSetup } from "@/app/components/skills/mcp-agent-skill-setup"
import { Badge } from "@/app/components/ui/badge"
import { ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader, SectionCardTitle } from "@/app/components/ui/section-card"
import { AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS, createMakinariMcpSkill } from "@/lib/makinari-mcp-skill"
import { isRealSiteId } from "@/lib/demo-utils"

export function McpSkillCard() {
  const [expanded, setExpanded] = useState(false)
  const siteContext = useOptionalSite()
  const currentSiteId = siteContext?.currentSite?.id
  const siteId = isRealSiteId(currentSiteId) ? currentSiteId : null
  const preview = createMakinariMcpSkill({
    apiKey: "YOUR_API_KEY",
    userId: "YOUR_USER_ID",
    expirationDays: AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS,
    siteId,
  })

  return (
    <SectionCard id="skill-makinari">
      <SectionCardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <SectionCardTitle>Makinari MCP</SectionCardTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {siteId
                ? "Connect your agent to the selected site with its site ID and a site-bound API key valid for 90 days."
                : "Set up a new site with your agent if the MCP supports creation, or follow the create-site instructions, with an API key valid for 90 days."}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {["MCP", "Backend", "Automation", "Leads"].map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
            </div>
          </div>
          <button
            type="button"
            aria-label={expanded ? "Collapse Makinari MCP" : "Expand Makinari MCP"}
            aria-expanded={expanded}
            aria-controls="makinari-mcp-preview"
            onClick={() => setExpanded((value) => !value)}
            className="p-2 hover:bg-muted/50 rounded-md transition-colors shrink-0"
          >
            {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </button>
        </div>
      </SectionCardHeader>
      {expanded && (
        <SectionCardContent className="pb-0 pt-0">
          <div className="border dark:border-white/5 border-black/5 rounded-lg bg-muted/30 p-6 overflow-auto max-h-[500px]">
            <pre id="makinari-mcp-preview" className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground">{preview}</pre>
          </div>
        </SectionCardContent>
      )}
      <SectionCardFooter>
        <McpAgentSkillSetup expirationDays={AGENT_SKILLS_MCP_KEY_EXPIRATION_DAYS} siteId={siteId} />
      </SectionCardFooter>
    </SectionCard>
  )
}