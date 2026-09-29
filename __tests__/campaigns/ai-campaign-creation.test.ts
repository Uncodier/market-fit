import { createCampaign } from "@/app/campaigns/actions/campaigns/create"
import { buildAiCampaignBrief } from "@/app/campaigns/ai-requirement"
import { campaignFormSchema, type CampaignFormValues } from "@/app/campaigns/schema"
import { createClient } from "@/lib/supabase/server"
import { requestServerVoiceAgentResync } from "@/app/agents/server-voice-sync"

jest.mock("@/lib/auth/api-site-access", () => ({
  getCurrentUserSiteRole: jest.fn(async (client, siteId) => {
    const { data, error } = await client.rpc("current_user_site_role", { p_site_id: siteId })
    return error ? null : data
  }),
}))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/app/agents/server-voice-sync", () => ({
  requestServerVoiceAgentResync: jest.fn(),
}))

const siteId = "site-1"
const userId = "authenticated-user"
const segmentId = "segment-1"
const values: CampaignFormValues = {
  title: "Summer launch",
  description: "Launch a summer campaign for new customers.",
  priority: "high",
  type: "outbound",
  dueDate: "2026-10-30",
  segments: [segmentId],
  createWithAi: true,
  budget: { allocated: 300, remaining: 300, currency: "USD" },
  site_id: siteId,
  user_id: "forged-user",
}

function mockDatabase(options: {
  user?: boolean
  role?: string | null
  segments?: Array<{ id: string; name: string }>
  failRelation?: boolean
} = {}) {
  const inserts: Array<{ table: string; payload: Record<string, unknown> | Array<Record<string, unknown>> }> = []
  const deletions: string[] = []
  const from = jest.fn((table: string) => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        in: jest.fn().mockResolvedValue({
          data: options.segments ?? [{ id: segmentId, name: "New customers" }],
          error: null,
        }),
      })),
    })),
    insert: jest.fn((payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
      inserts.push({ table, payload })
      const error = options.failRelation && table === "campaign_requirements"
        ? { message: "relation failed" }
        : null
      return {
        select: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: table === "campaigns" ? "campaign-1" : "requirement-1" },
            error,
          }),
        })),
        then: (resolve: (result: { error: typeof error }) => void) => Promise.resolve({ error }).then(resolve),
      }
    }),
    delete: jest.fn(() => ({
      eq: jest.fn((column: string, id: string) => {
        if (column === "id") deletions.push(`${table}:${id}`)
        return {
          eq: jest.fn().mockResolvedValue({ error: null }),
          then: (resolve: (result: { error: null }) => void) => Promise.resolve({ error: null }).then(resolve),
        }
      }),
    })),
  }))
  const client = {
    auth: { getUser: jest.fn().mockResolvedValue({
      data: { user: options.user === false ? null : { id: userId } }, error: null,
    }) },
    rpc: jest.fn().mockResolvedValue({ data: options.role === undefined ? "marketing" : options.role, error: null }),
    from,
  }
  ;(createClient as jest.Mock).mockResolvedValue(client)
  return { client, inserts, deletions }
}

describe("AI campaign creation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("requires a useful description when AI is enabled", () => {
    expect(campaignFormSchema.safeParse({ ...values, description: "  " }).success).toBe(false)
    expect(campaignFormSchema.safeParse({ ...values, createWithAi: false, description: "" }).success).toBe(true)
  })

  it("builds a complete brief and keeps secrets out of the request", () => {
    const brief = buildAiCampaignBrief(values, ["New customers"])
    for (const part of [
      values.title, values.description!, "outbound", "high", values.dueDate!,
      "300 USD", "New customers", "Makinari tools", "API keys", "approvals",
    ]) {
      expect(brief).toContain(part)
    }
    expect(brief).toContain("do not request or store secrets")
  })

  it("creates a pending, in-progress AI requirement linked to the campaign and target segments", async () => {
    const { client, inserts } = mockDatabase()
    const result = await createCampaign(values)

    expect(result).toEqual({ data: { id: "campaign-1" }, error: null })
    expect(createClient).toHaveBeenCalledWith(true)
    expect(client.rpc).toHaveBeenCalledWith("current_user_site_role", { p_site_id: siteId })
    expect(inserts.map(({ table }) => table)).toEqual([
      "campaigns", "campaign_segments", "requirements", "requirement_segments", "campaign_requirements",
    ])
    const campaign = inserts[0].payload as Record<string, unknown>
    expect(campaign).toMatchObject({ user_id: userId, site_id: siteId, status: "active" })
    const requirement = inserts[2].payload as Record<string, unknown>
    expect(requirement).toMatchObject({
      type: "campaign", status: "in-progress", completion_status: "pending",
      source: "Campaign", site_id: siteId, user_id: userId, priority: "high", budget: 300,
    })
    expect(requirement.cycle).toEqual(expect.any(String))
    expect(requirement.description).toContain(values.description)
    expect(requirement.instructions).toContain(values.dueDate)
    expect(inserts[3].payload).toEqual([{ requirement_id: "requirement-1", segment_id: segmentId }])
    expect(inserts[4].payload).toEqual({ campaign_id: "campaign-1", requirement_id: "requirement-1" })
    expect(requestServerVoiceAgentResync).toHaveBeenCalledWith(siteId)
  })

  it("creates only the campaign when AI is disabled", async () => {
    const { inserts } = mockDatabase()
    expect(await createCampaign({ ...values, createWithAi: false })).toEqual({ data: { id: "campaign-1" }, error: null })
    expect(inserts.map(({ table }) => table)).toEqual(["campaigns", "campaign_segments"])
  })

  it("rejects unauthenticated, unauthorized, and invalid site segments without writing", async () => {
    for (const options of [
      { user: false },
      { role: null },
      { segments: [] },
    ]) {
      const { inserts } = mockDatabase(options)
      expect((await createCampaign(values)).error).toBeTruthy()
      expect(inserts).toHaveLength(0)
    }
  })

  it("rejects malformed AI briefs before authenticating or writing", async () => {
    const { client, inserts } = mockDatabase()
    expect((await createCampaign({ ...values, description: "  " })).error).toBe("Invalid campaign details")
    expect(client.auth.getUser).not.toHaveBeenCalled()
    expect(inserts).toHaveLength(0)
  })

  it("rolls back both records when the campaign-to-requirement link fails", async () => {
    const { deletions } = mockDatabase({ failRelation: true })
    const result = await createCampaign(values)
    expect(result.data).toBeNull()
    expect(result.error).toContain("link AI campaign requirement")
    expect(deletions).toEqual(["requirements:requirement-1", "campaigns:campaign-1"])
    expect(requestServerVoiceAgentResync).not.toHaveBeenCalled()
  })
})