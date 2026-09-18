import { processRecordEmbeddingsById } from "@/app/records/lib/record-embedding-worker"

jest.mock("server-only", () => ({}))

const recordId = "00000000-0000-4000-8000-000000000100"

describe("record embedding API client", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.API_SERVER_URL = "https://api.example.com"
    process.env.SERVICE_API_KEY = "service-key"
  })

  afterEach(() => {
    delete process.env.API_SERVER_URL
    delete process.env.SERVICE_API_KEY
  })

  it("delegates embedding processing to the API server", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        processedJobs: 1,
        processedNodes: 2,
        remainingNodes: 0,
        stale: false,
      }),
    } as Response)

    const result = await processRecordEmbeddingsById({
      recordId,
      requestedNodeIds: ["00000000-0000-4000-8000-000000000101"],
    })

    expect(result).toEqual({
      processedJobs: 1,
      processedNodes: 2,
      remainingNodes: 0,
      stale: false,
    })
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/records/embed",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-api-key": "service-key" }),
        body: JSON.stringify({
          record_id: recordId,
          changed_node_ids: ["00000000-0000-4000-8000-000000000101"],
        }),
      })
    )
  })

  it("fails closed when API configuration is missing", async () => {
    delete process.env.API_SERVER_URL
    delete process.env.NEXT_PUBLIC_API_SERVER_URL
    delete process.env.SERVICE_API_KEY

    await expect(processRecordEmbeddingsById({ recordId })).rejects.toThrow(
      "Embedding service is not configured"
    )
  })
})
