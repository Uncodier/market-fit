import { readFileSync } from "node:fs"
import path from "node:path"
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
  const feedbackInput = {
    siteId: "site-1",
    source: "robots" as const,
    sourceId: "log-1",
    rating: "Like" as const,
    title: "How can I improve retention?",
    response: "Start with cohort analysis.",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => {})
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

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("has a migration for the feedback upsert conflict keys", () => {
    const migration = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260915212000_ai_feedback_records.sql"),
      "utf8",
    )
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS system_key text")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_type text")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_id text")
    expect(migration).toContain("(site_id, system_key)")
    expect(migration).toContain("(site_id, source_type, source_id)")
  })

  it("repairs missing feedback keys in a forward migration and documents them", () => {
    const migration = readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260926075940_restore_ai_feedback_record_keys.sql"),
      "utf8",
    )
    expect(migration).toContain("BEGIN;")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS system_key text")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_type text")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS source_id text")
    expect(migration).toContain("(site_id, system_key)")
    expect(migration).toContain("(site_id, source_type, source_id)")
    expect(migration).toContain("COMMENT ON COLUMN public.record_categories.system_key")
    expect(migration).toContain("COMMENT ON COLUMN public.records.source_type")
    expect(migration).toContain("COMMENT ON COLUMN public.records.source_id")
    expect(migration).toContain("COMMIT;")
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

  it.each([
    ["PGRST204", "record_categories", categoryUpsert],
    ["42703", "records", recordUpsert],
    ["42P10", "records", recordUpsert],
  ])("explains missing feedback schema (%s in %s)", async (code, table, upsert) => {
    upsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: null, error: { code, message: "Database schema mismatch" } }),
      }),
    })

    const result = await syncAiFeedbackRecord(feedbackInput)

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("20260926075940_restore_ai_feedback_record_keys"),
    })
    expect(categoryUpsert).toHaveBeenCalled()
    expect(recordUpsert).toHaveBeenCalledTimes(table === "records" ? 1 : 0)
  })

  it("explains missing feedback columns when clearing feedback", async () => {
    recordDelete.mockImplementation(() => {
      const query: any = {
        eq: jest.fn(() => query),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ error: { code: "42703", message: "Missing column" } }),
      }
      return query
    })

    const result = await syncAiFeedbackRecord({ ...feedbackInput, rating: null })

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("20260926075940_restore_ai_feedback_record_keys"),
    })
    expect(categoryUpsert).not.toHaveBeenCalled()
  })

  it("does not misdiagnose unrelated database errors as a missing migration", async () => {
    categoryUpsert.mockReturnValue({
      select: () => ({ single: async () => ({ data: null, error: new Error("Permission denied") }) }),
    })

    expect(await syncAiFeedbackRecord(feedbackInput)).toEqual({
      success: false,
      error: "Permission denied",
    })
  })

  it("preserves the fallback when the records API returns no row or error", async () => {
    recordUpsert.mockReturnValue({
      select: () => ({ single: async () => ({ data: null, error: null }) }),
    })

    expect(await syncAiFeedbackRecord(feedbackInput)).toEqual({
      success: false,
      error: "Could not save feedback record",
    })
  })
})
