import { createClient } from "../../lib/supabase/server"
import { POST } from "@/app/api/records/embed/route"
import { processRecordEmbeddingsById } from "@/app/records/lib/record-embedding-worker"

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))
jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))
jest.mock("@/app/records/lib/record-embedding-worker", () => ({
  processRecordEmbeddingsById: jest.fn(),
}))

function request(body: unknown) {
  return { json: async () => body } as any
}

describe("record embedding route authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it("rejects unauthenticated callers before elevated access", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    const response = await POST(request({
      record_id: "00000000-0000-4000-8000-000000000100",
    }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("rejects unbounded or malformed node requests", async () => {
    const response = await POST(request({
      record_id: "not-a-uuid",
      changed_node_ids: Array.from({ length: 201 }, () => "not-a-uuid"),
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid embedding request" })
  })

  it.each([true, null, "false"])("denies private embeddings for location state %p before record reads or external dispatch", async data => {
    const from = jest.fn()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "actor" } }, error: null }) },
      rpc: jest.fn().mockResolvedValue({ data, error: null }), from,
    })
    expect((await POST(request({ record_id: "00000000-0000-4000-8000-000000000100" }))).status).toBe(403)
    expect(from).not.toHaveBeenCalled()
    expect(processRecordEmbeddingsById).not.toHaveBeenCalled()
  })
})
