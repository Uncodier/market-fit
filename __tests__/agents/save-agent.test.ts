jest.mock("../../app/services/api-client-service", () => ({
  apiClient: {
    patch: jest.fn(),
  },
}))

import { upsertAgentRecord, type AgentUpsertInput } from "../../app/agents/save-agent"
import { getDefaultAgentTemplate, resolveTemplateRole } from "../../app/agents/agent-defaults"
import { apiClient } from "../../app/services/api-client-service"

const mockPatch = apiClient.patch as jest.Mock

const UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

function baseInput(overrides: Partial<AgentUpsertInput> = {}): AgentUpsertInput {
  return {
    agentId: "support",
    isNewAgent: false,
    siteId: "site-1",
    userId: "user-1",
    name: "Customer Support",
    description: "Knowledge base management, FAQ development, customer issue escalation",
    type: "support",
    status: "inactive",
    prompt: "You are a Customer Support assistant.",
    backstory: "I have built support teams from the ground up.",
    role: "Customer Support",
    tools: {},
    activities: {},
    integrations: {},
    configuration: { contextFiles: [], triggers: {} },
    ...overrides,
  }
}

function createChain(result: { data: any; error: any }) {
  const chain: any = {}
  for (const method of ["select", "eq", "upsert", "update", "insert"]) {
    chain[method] = jest.fn(() => chain)
  }
  chain.maybeSingle = jest.fn().mockResolvedValue(result)
  chain.single = jest.fn().mockResolvedValue(result)
  return chain
}

describe("upsertAgentRecord", () => {
  const requiredFields = {
    name: "Customer Support",
    type: "support",
    status: "inactive",
    prompt: "You are a Customer Support assistant.",
    site_id: "site-1",
    user_id: "user-1",
  }

  beforeEach(() => {
    mockPatch.mockClear()
    mockPatch.mockResolvedValue({ success: true, data: { synced: false } })
  })

  it("inserts a complete row when the template agent was never created", async () => {
    const lookup = createChain({ data: null, error: null })
    const insert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn((table: string) => {
      expect(table).toBe("agents")
      if (from.mock.calls.length === 1) return lookup
      return insert
    })

    const savedId = await upsertAgentRecord({ from }, baseInput())

    expect(savedId).toBe(UUID)
    expect(insert.insert).toHaveBeenCalledWith([expect.objectContaining(requiredFields)])
    expect(insert.insert.mock.calls[0][0][0]).not.toHaveProperty("id")
    expect(mockPatch).toHaveBeenCalledWith("/api/integrations/zavu/voice", {
      siteId: "site-1",
    })
  })

  it("updates the existing row when one already exists for the same role and site", async () => {
    const lookup = createChain({ data: { id: UUID }, error: null })
    const update = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return update
    })

    const savedId = await upsertAgentRecord({ from }, baseInput({ name: "Support Desk" }))

    expect(savedId).toBe(UUID)
    expect(update.update).toHaveBeenCalledWith(
      expect.objectContaining({ ...requiredFields, name: "Support Desk" })
    )
    expect(update.eq).toHaveBeenCalledWith("id", UUID)
  })

  it("upserts by id when the URL has a UUID even if the row is missing", async () => {
    const lookup = createChain({ data: null, error: null })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    const savedId = await upsertAgentRecord({ from }, baseInput({ agentId: UUID }))

    expect(savedId).toBe(UUID)
    expect(upsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ...requiredFields, id: UUID, role: "Customer Support" }),
      { onConflict: "id", ignoreDuplicates: false }
    )
  })

  it("keeps the stored role when upserting an existing UUID agent", async () => {
    const lookup = createChain({ data: { id: UUID, role: "Customer Support" }, error: null })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    await upsertAgentRecord(
      { from },
      baseInput({ agentId: UUID, role: "Growth Lead/Manager" })
    )

    expect(upsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: UUID, role: "Customer Support" }),
      expect.any(Object)
    )
  })

  it("does not sync Voice when a UUID agent's stored role is not Customer Support", async () => {
    const lookup = createChain({ data: { id: UUID, role: "Growth Marketer" }, error: null })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    await upsertAgentRecord({ from }, baseInput({ agentId: UUID }))

    expect(mockPatch).not.toHaveBeenCalled()
  })

  it("preserves provider synchronization metadata when editing configuration", async () => {
    const lookup = createChain({
      data: {
        id: UUID,
        role: "Customer Support",
        configuration: {
          zavu: { agent_id: "agent_1", tool_webhook_secret: "encrypted" },
          legacy: true,
        },
      },
      error: null,
    })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    await upsertAgentRecord(
      { from },
      baseInput({ agentId: UUID, configuration: { contextFiles: [], triggers: {} } })
    )

    expect(upsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: {
          zavu: { agent_id: "agent_1", tool_webhook_secret: "encrypted" },
          legacy: true,
          contextFiles: [],
          triggers: {},
        },
      }),
      expect.any(Object)
    )
  })

  it("throws when supabase returns an error instead of pretending the save succeeded", async () => {
    const lookup = createChain({ data: null, error: null })
    const insert = createChain({
      data: null,
      error: { message: "null value in column \"prompt\" of relation \"agents\"" },
    })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return insert
    })

    await expect(upsertAgentRecord({ from }, baseInput())).rejects.toMatchObject({
      message: expect.stringContaining("prompt"),
    })
  })

  it("keeps a successful local save when Voice synchronization fails", async () => {
    const lookup = createChain({ data: null, error: null })
    const insert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return insert
    })
    mockPatch.mockResolvedValue({
      success: false,
      error: { message: "Zavu is unavailable" },
    })

    await expect(upsertAgentRecord({ from }, baseInput())).resolves.toBe(UUID)
  })
})

describe("resolveTemplateRole", () => {
  it("maps the support template id used in the agents list", () => {
    expect(resolveTemplateRole("support", false)).toBe("Customer Support")
    expect(getDefaultAgentTemplate("support", false).type).toBe("support")
    expect(getDefaultAgentTemplate("support", false).promptTemplate).toContain("Customer Support")
  })
})
