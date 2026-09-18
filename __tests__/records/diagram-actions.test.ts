import { createClient, createServiceClient } from "../../lib/supabase/server"
import {
  getRecordDiagram,
  saveRecordDiagram,
} from "@/app/records/[id]/diagram-actions"
import type { RecordDiagramDraft } from "@/app/records/lib/record-diagram"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/server", () => ({ after: jest.fn() }))
jest.mock("@/app/records/lib/record-embedding-worker", () => ({
  processRecordEmbeddingsById: jest.fn(),
}))
jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

const recordId = "00000000-0000-4000-8000-000000000100"
const nodeId = "00000000-0000-4000-8000-000000000101"

function diagram(): RecordDiagramDraft {
  return {
    revision: 4,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [{
      id: nodeId,
      kind: "concept",
      title: "Signal",
      content: "Customers need exports.",
      metadata: {},
      position: { x: 80, y: 80 },
    }],
    edges: [],
  }
}

describe("record diagram actions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it("rejects loading when the caller is not authenticated", async () => {
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    const result = await getRecordDiagram(recordId)
    expect(result).toEqual({ diagram: null, error: "Not authenticated" })
  })

  it("reports optimistic revision conflicts without overwriting", async () => {
    const recordQuery: any = {
      select: jest.fn(() => recordQuery),
      eq: jest.fn(() => recordQuery),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: recordId,
          site_id: "00000000-0000-4000-8000-000000000200",
          title: "Research",
          category: { name: "Discovery" },
        },
        error: null,
      }),
    }
    const serviceRpc = jest.fn().mockResolvedValue({
      data: null,
      error: { code: "40001", message: "Diagram revision conflict" },
    })
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn(() => recordQuery),
      rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
    })
    ;(createServiceClient as jest.Mock).mockResolvedValue({ rpc: serviceRpc })

    const result = await saveRecordDiagram({ recordId, diagram: diagram() })
    expect(result).toEqual(expect.objectContaining({
      success: false,
      conflict: true,
    }))
    expect(serviceRpc).toHaveBeenCalledWith(
      "save_record_diagram",
      expect.objectContaining({ p_expected_revision: 4 })
    )
  })

  it("rejects malformed edge payloads before calling the database", async () => {
    const rpc = jest.fn()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      rpc,
    })
    const malformed = {
      ...diagram(),
      edges: [{
        id: "00000000-0000-4000-8000-000000000102",
        source: nodeId,
        target: "00000000-0000-4000-8000-000000000999",
        type: "supports" as const,
        metadata: {},
      }],
    }

    const result = await saveRecordDiagram({ recordId, diagram: malformed })
    expect(result.success).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
