import { createClient, createServiceClient } from "../../lib/supabase/server"
import { syncAiFeedbackRecord } from "@/app/records/response-record-actions"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
  createServiceClient: jest.fn(),
}))

describe("syncAiFeedbackRecord", () => {
  const categoryUpsert = jest.fn()
  const recordUpsert = jest.fn()
  const recordDelete = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    })

    categoryUpsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "feedback-category" }, error: null }),
      }),
    })
    recordUpsert.mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: "feedback-record" }, error: null }),
      }),
    })

    const siteQuery: any = {
      select: jest.fn(() => siteQuery),
      eq: jest.fn(() => siteQuery),
      maybeSingle: jest.fn().mockResolvedValue({ data: { user_id: "user-1" }, error: null }),
    }
    const deleteQuery: any = {
      delete: jest.fn(() => deleteQuery),
      eq: jest.fn(() => deleteQuery),
      then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
    }
    recordDelete.mockImplementation(() => deleteQuery)

    ;(createServiceClient as jest.Mock).mockResolvedValue({
      from: jest.fn((table: string) => {
        if (table === "sites") return siteQuery
        if (table === "record_categories") return { upsert: categoryUpsert }
        if (table === "records") {
          return {
            upsert: recordUpsert,
            delete: recordDelete,
          }
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    })
  })

  it("upserts a readable feedback record with stable conflict keys", async () => {
    const result = await syncAiFeedbackRecord({
      siteId: "site-1",
      source: "robots",
      sourceId: "log-1",
      rating: "Like",
      title: "How can I improve retention?",
      response: "Start with cohort analysis.",
      instanceId: "instance-1",
    })

    expect(result).toEqual({ success: true, recordId: "feedback-record" })
    expect(categoryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ system_key: "ai-feedback", name: "AI Feedback" }),
      { onConflict: "site_id,system_key" },
    )
    expect(recordUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: "robots",
        source_id: "log-1",
        title: "How can I improve retention?",
        description: "Rating: Like\nSource: Robots\n\nStart with cohort analysis.",
        data: expect.objectContaining({ Rating: "Like", Source: "Robots" }),
      }),
      { onConflict: "site_id,source_type,source_id" },
    )
  })

  it("removes the reference record when all feedback is cleared", async () => {
    const result = await syncAiFeedbackRecord({
      siteId: "site-1",
      source: "chat",
      sourceId: "message-1",
      rating: null,
      title: "Question",
      response: "Answer",
    })

    expect(result).toEqual({ success: true })
    expect(recordDelete).toHaveBeenCalled()
    expect(categoryUpsert).not.toHaveBeenCalled()
    expect(recordUpsert).not.toHaveBeenCalled()
  })
})
