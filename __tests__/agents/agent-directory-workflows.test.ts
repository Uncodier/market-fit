import { templateShortcut } from "@/app/agents/list/template-workflows"
import { agents } from "@/app/data/mock-agents"
import type { AgentActivity } from "@/app/types/agents"

const mockPost = jest.fn()
const mockSegments = jest.fn()
const mockCampaigns = jest.fn()
const mockContent = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: (...args: unknown[]) => mockPost(...args) } }))
jest.mock("@/app/services/ai-service", () => ({
  buildSegmentsWithAI: (...args: unknown[]) => mockSegments(...args),
  buildCampaignsWithAI: (...args: unknown[]) => mockCampaigns(...args),
  buildContentWithAI: (...args: unknown[]) => mockContent(...args),
}))

const params = { siteId: "site", userId: "user", url: "https://example.test" }
const activities = agents.flatMap(agent => agent.activities as AgentActivity[])
const shortcut = (id: string) => templateShortcut(activities.find(a => a.id === id)!)!

it.each([
  ["sl1", "leadFollowUpManagement"], ["sl3", "leadGeneration"], ["sl6", "keyAccountGeneration"],
  ["sl7", "idealClientProfileMining"], ["sl8", "leadQualificationManagement"], ["gl6", "dailyStandUp"],
  ["gl7", "assignLeads"], ["ux1", "analyzeSite"], ["cs4", "syncEmails"],
])("retains the %s site's workflow shortcut", async (id, path) => {
  mockPost.mockResolvedValueOnce({ success: true })
  expect(await shortcut(id).run(params)).toEqual({ result: { success: true } })
  expect(mockPost).toHaveBeenLastCalledWith(`/api/workflow/${path}`, {
    site_id: params.siteId, ...(["ux1", "cs4"].includes(id) && { user_id: params.userId }),
    ...(id === "ux1" && { url: params.url, provider: "openai", modelId: "gpt-4o", includeScreenshot: true }),
  })
})

it.each([
  ["mk4", "/segments/new-segment", mockSegments, { segmentCount: 3, analysisType: "general" }],
  ["mk1", "/campaigns", mockCampaigns, { campaignCount: 3 }],
  ["ct1", "/content", mockContent, { contentCount: 3 }],
] as const)("retains the %s builder and destination", async (id, href, builder, options) => {
  builder.mockResolvedValueOnce({ success: true, data: { segmentId: "new-segment" } })
  expect(shortcut(id).requiresUrl).toBe(true)
  expect((await shortcut(id).run(params)).href).toBe(href)
  expect(builder).toHaveBeenCalledWith({ ...options, site_id: params.siteId, user_id: params.userId, url: params.url,
    mode: "create", provider: "openai", modelId: "gpt-4o", includeScreenshot: true })
})