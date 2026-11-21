/** @jest-environment node */

import { upsertAgentRecord, type AgentUpsertInput } from "../../app/agents/save-agent"
import { getDefaultAgentTemplate, resolveTemplateRole } from "../../app/agents/agent-defaults"
const mockFetch = jest.mocked(fetch)

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

function createChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), or: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result), single: jest.fn().mockResolvedValue(result),
  }
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
    mockFetch.mockReset().mockResolvedValue(Response.json({ success: true, status: "accepted" }, { status: 202 }))
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
    // The immutable setup UUID arbitrates concurrent inserts of this template.
    expect(insert.insert.mock.calls[0][0][0].id).toEqual(expect.stringMatching(/^[a-f\d-]{36}$/))
    expect(mockFetch).toHaveBeenCalledWith("/api/settings/voice-sync", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ siteId: "site-1" }),
    }))
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
    expect(lookup.eq).toHaveBeenCalledWith("role", "Customer Support")
    expect(lookup.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(lookup.or).toHaveBeenCalledWith("configuration->>agentOrigin.is.null,configuration->>agentOrigin.neq.independent")
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ name: "Support Desk" }))
    expect(update.update.mock.calls[0][0]).not.toHaveProperty("user_id")
    expect(update.update.mock.calls[0][0]).not.toHaveProperty("site_id")
    expect(update.eq).toHaveBeenCalledWith("site_id", "site-1")
    expect(update.eq).toHaveBeenCalledWith("id", UUID)
  })

  it("recovers a concurrent template setup by its exact identity without changing the winning configuration", async () => {
    const lookup = createChain({ data: null, error: null })
    const conflict = createChain({ data: null, error: { code: "23505" } })
    const winner = createChain({ data: null, error: null })
    winner.maybeSingle.mockImplementation(() => Promise.resolve({ data: { id: conflict.insert.mock.calls[0][0][0].id }, error: null }))
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(conflict).mockReturnValueOnce(winner)
    const savedId = await upsertAgentRecord({ from }, baseInput())
    expect(winner.eq).toHaveBeenCalledWith("id", savedId)
    expect(winner.eq).toHaveBeenCalledWith("site_id", "site-1")
    expect(winner.eq).toHaveBeenCalledWith("user_id", "user-1")
    expect(winner.or).toHaveBeenCalledWith("configuration->>agentOrigin.is.null,configuration->>agentOrigin.neq.independent")
    expect(winner.update).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("inserts by id when a UUID row is missing without overwriting an RLS-hidden conflict", async () => {
    const lookup = createChain({ data: null, error: null })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    const savedId = await upsertAgentRecord({ from }, baseInput({ agentId: UUID }))

    expect(savedId).toBe(UUID)
    expect(upsert.insert).toHaveBeenCalledWith([expect.objectContaining({ ...requiredFields, id: UUID, role: "Customer Support" })])
    expect(upsert.upsert).not.toHaveBeenCalled()
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

    expect(upsert.update).toHaveBeenCalledWith(expect.objectContaining({ role: "Customer Support" }))
    expect(upsert.eq).toHaveBeenCalledWith("id", UUID)
    expect(lookup.eq).toHaveBeenCalledWith("site_id", "site-1")
  })

  it("does not sync Voice when a UUID agent's stored role is not Customer Support", async () => {
    const lookup = createChain({ data: { id: UUID, role: "Growth Marketer" }, error: null })
    const upsert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return upsert
    })

    await upsertAgentRecord({ from }, baseInput({ agentId: UUID }))

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('an editor save of a persisted prompt cannot replace tools, provider configuration, supervisor or another open section', async () => {
    const lookup = createChain({ data: { id: UUID, role: 'Growth Marketer', configuration: { agentOrigin: 'independent' } }, error: null })
    const target = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(target)
    const input = { ...baseInput({ agentId: UUID, prompt: 'New prompt', name: 'Unsaved name' }), section: 'prompt' as const }
    await upsertAgentRecord({ from }, input)
    expect(target.update).toHaveBeenCalledWith({ prompt: 'New prompt', updated_at: expect.any(String) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not recreate a persisted profile deleted after opening the editor', async () => {
    const missing = createChain({ data: null, error: null })
    const from = jest.fn().mockReturnValue(missing)
    const input = { ...baseInput({ agentId: UUID }), section: 'basic' as const }
    await expect(upsertAgentRecord({ from }, input)).rejects.toThrow('unavailable')
    expect(missing.insert).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
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

    expect(upsert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: {
          zavu: { agent_id: "agent_1", tool_webhook_secret: "encrypted" },
          legacy: true,
          contextFiles: [],
          triggers: {},
        },
      }),
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

  it("submits a blank draft by idempotency key, without a role lookup, inherited grants or voice sync", async () => {
    mockFetch.mockResolvedValue(Response.json({ id: UUID }, { status: 201 }))
    const from = jest.fn()
    const input = baseInput({ agentId: "new", isNewAgent: true, creationId: UUID })
    await expect(upsertAgentRecord({ from }, input)).resolves.toBe(UUID)
    expect(from).not.toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [path, options] = mockFetch.mock.calls[0]
    expect(path).toBe("/api/agents/create")
    expect(JSON.parse(String(options?.body))).toEqual({ siteId: input.siteId, creationId: UUID,
      name: input.name, role: input.role, description: input.description, prompt: input.prompt, backstory: input.backstory })
    await expect(upsertAgentRecord({ from }, { ...input, creationId: undefined })).rejects.toThrow("draft identity")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("preserves independent origin on edit and never resyncs Voice even when the role is Customer Support", async () => {
    const lookup = createChain({ data: { id: UUID, role: "Customer Support", configuration: {
      agentOrigin: "independent", creationFingerprint: "persisted",
    } }, error: null })
    const update = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update)
    await upsertAgentRecord({ from }, baseInput({ agentId: UUID, configuration: { agentOrigin: null, creationFingerprint: "changed" } }))
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ configuration: {
      agentOrigin: "independent", creationFingerprint: "persisted",
    } }))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('writes only the first-class supervisor for a hierarchy-only edit and permits an explicit clear', async () => {
    const supervisor = '10000000-0000-4000-8000-000000000001'
    const lookup = createChain({ data: { id: UUID, role: 'Customer Support' }, error: null })
    const parent = createChain({ data: { id: supervisor, supervisor: null }, error: null })
    const update = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(parent).mockReturnValueOnce(update)
      .mockReturnValueOnce(lookup).mockReturnValueOnce(update)
    for (const value of [supervisor, null]) {
      expect(await upsertAgentRecord({ from }, baseInput({ agentId: UUID, supervisor: value, supervisorOnly: true }))).toBe(UUID)
      expect(update.update).toHaveBeenLastCalledWith({ supervisor: value })
    }
    expect(parent.eq).toHaveBeenCalledWith('site_id', 'site-1')
    expect(update.eq).toHaveBeenCalledWith('id', UUID)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('rejects self and indirect cycles before updating, and does not resurrect a missing hierarchy-only target', async () => {
    const supervisor = '10000000-0000-4000-8000-000000000001'
    const lookup = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(lookup)
      .mockReturnValueOnce(createChain({ data: { id: supervisor, supervisor: UUID }, error: null }))
      .mockReturnValueOnce(createChain({ data: null, error: null }))
    for (const value of [UUID, supervisor, null]) {
      await expect(upsertAgentRecord({ from }, baseInput({ agentId: UUID, supervisorOnly: true, supervisor: value }))).rejects.toThrow()
    }
    expect(lookup.update).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('surfaces a concurrent hierarchy rejection without replaying the write or invoking Voice', async () => {
    const lookup = createChain({ data: { id: UUID, role: 'Customer Support' }, error: null })
    const update = createChain({ data: null, error: { code: '40001' } })
    const from = jest.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update)
    await expect(upsertAgentRecord({ from }, baseInput({ agentId: UUID, supervisorOnly: true, supervisor: null }))).rejects.toThrow('hierarchy changed')
    expect(update.update).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("rejects an ambiguous template lookup or unknown template URL instead of picking an overwrite target", async () => {
    const lookup = createChain({ data: null, error: { code: "PGRST116" } })
    const from = jest.fn().mockReturnValue(lookup)
    await expect(upsertAgentRecord({ from }, baseInput())).rejects.toMatchObject({ code: "PGRST116" })
    await expect(upsertAgentRecord({ from }, baseInput({ agentId: "not-a-role" }))).rejects.toThrow("Unknown agent template")
    expect(from).toHaveBeenCalledTimes(1)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("keeps a successful local save when Voice synchronization fails", async () => {
    const lookup = createChain({ data: null, error: null })
    const insert = createChain({ data: { id: UUID }, error: null })
    const from = jest.fn(() => {
      if (from.mock.calls.length === 1) return lookup
      return insert
    })
    mockFetch.mockResolvedValue(Response.json({ success: false }, { status: 503 }))

    await expect(upsertAgentRecord({ from }, baseInput())).resolves.toBe(UUID)
  })
})

describe("resolveTemplateRole", () => {
  it("does not fill a blank draft with a role's instructions or identity", () => {
    expect(resolveTemplateRole("new", true)).toBe("")
    expect(getDefaultAgentTemplate("new", true)).toMatchObject({ role: "", name: "", description: "", promptTemplate: "", backstory: "" })
    expect(getDefaultAgentTemplate("new", true, "sales")).toMatchObject({ role: "Sales/CRM Specialist", type: "sales", name: "", promptTemplate: "" })
  })
  it("maps the support template id used in the agents list", () => {
    expect(resolveTemplateRole("support", false)).toBe("Customer Support")
    expect(getDefaultAgentTemplate("support", false).type).toBe("support")
    expect(getDefaultAgentTemplate("support", false).promptTemplate).toContain("Customer Support")
  })
})
