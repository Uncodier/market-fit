import type { AgentActivity } from "@/app/types/agents"

type Context = { siteId: string; userId: string; url?: string | null }
type Outcome = { success: boolean; error?: unknown }
type Shortcut = {
  name: string; loading: string; success: string; requiresUrl?: boolean
  run(context: Context): Promise<{ result: Outcome; href?: string }>
}

function workflow(path: string, mode?: "user" | "website"): Shortcut["run"] {
  return async ({ siteId, userId, url }) => {
    const { apiClient } = await import("@/app/services/api-client-service")
    const result = await apiClient.post(`/api/workflow/${path}`, {
      site_id: siteId, ...(mode && { user_id: userId }),
      ...(mode === "website" && { url, provider: "openai", modelId: "gpt-4o", includeScreenshot: true }),
    })
    return { result }
  }
}

function aiParams({ siteId, userId, url }: Context) {
  return { site_id: siteId, user_id: userId, url: url!, mode: "create" as const,
    provider: "openai" as const, modelId: "gpt-4o", includeScreenshot: true }
}

const shortcuts: Record<string, Shortcut> = {
  cs4: { name: "Answer Emails", loading: "Synchronizing emails...", success: "Email synchronization completed successfully!", run: workflow("syncEmails", "user") },
  gl6: { name: "Daily Stand Up", loading: "Generating daily team progress report...", success: "Daily stand up report generated successfully!", run: workflow("dailyStandUp") },
  gl7: { name: "Assign Leads", loading: "Assigning leads to team members...", success: "Leads assigned successfully!", run: workflow("assignLeads") },
  sl1: { name: "Lead Follow-up Management", loading: "Managing lead follow-up sequences...", success: "Lead follow-up management completed successfully!", run: workflow("leadFollowUpManagement") },
  sl3: { name: "Lead Generation", loading: "Generating leads and identifying potential customers...", success: "Lead generation completed successfully!", run: workflow("leadGeneration") },
  sl6: { name: "Generate Key Accounts", loading: "Generating key account prospects...", success: "KeyAccountGeneration workflow completed successfully!", run: workflow("keyAccountGeneration") },
  sl7: { name: "ICP Mining", loading: "Mining Ideal Client Profile...", success: "ICP mining completed successfully!", run: workflow("idealClientProfileMining") },
  sl8: { name: "Lead Qualification", loading: "Qualifying leads based on BANT criteria...", success: "Lead qualification completed successfully!", run: workflow("leadQualificationManagement") },
  ux1: { name: "Website Analysis", loading: "Analyzing website usability and user experience...", success: "Website analysis completed successfully!", requiresUrl: true, run: workflow("analyzeSite", "website") },
  mk4: {
    name: "Analyze Segments", loading: "Analyzing segments and building customer profiles...", success: "Segment analysis completed successfully!", requiresUrl: true,
    async run(context) {
      const { buildSegmentsWithAI } = await import("@/app/services/ai-service")
      const result = await buildSegmentsWithAI({ ...aiParams(context), segmentCount: 3, analysisType: "general" })
      return { result, href: result.data?.segmentId ? `/segments/${encodeURIComponent(result.data.segmentId)}` : "/segments" }
    },
  },
  mk1: {
    name: "Create Marketing Campaign", loading: "Creating marketing campaigns with AI...", success: "Marketing campaigns created successfully!", requiresUrl: true,
    async run(context) {
      const { buildCampaignsWithAI } = await import("@/app/services/ai-service")
      return { result: await buildCampaignsWithAI({ ...aiParams(context), campaignCount: 3 }), href: "/campaigns" }
    },
  },
  ct1: {
    name: "Content Calendar Creation", loading: "Creating content calendar with AI...", success: "Content calendar created successfully!", requiresUrl: true,
    async run(context) {
      const { buildContentWithAI } = await import("@/app/services/ai-service")
      return { result: await buildContentWithAI({ ...aiParams(context), contentCount: 3 }), href: "/content" }
    },
  },
}

export function templateShortcut(activity: AgentActivity) {
  const shortcut = shortcuts[activity.id]
  return shortcut?.name === activity.name ? shortcut : undefined
}