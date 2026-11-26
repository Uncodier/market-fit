import { createClient } from "../../lib/supabase/server"
import {
  getRecords,
  updateRecord,
  createRecord,
  createRecordCategory,
  updateRecordCategory,
} from "@/app/records/actions"

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("next/server", () => ({ after: jest.fn() }))
jest.mock("@/app/records/lib/record-embedding-worker", () => ({
  processRecordEmbeddingsById: jest.fn(),
}))
jest.mock("../../lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

const recordId = "00000000-0000-4000-8000-000000000100"
const categoryId = "00000000-0000-4000-8000-000000000200"
const siteId = "00000000-0000-4000-8000-000000000300"

describe("record action authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, "error").mockImplementation(() => undefined)
  })

  afterEach(() => jest.restoreAllMocks())

  it("rejects record reads before querying when there is no user", async () => {
    const from = jest.fn()
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from,
    })

    const result = await getRecords("00000000-0000-4000-8000-000000000300")
    expect(result.error).toBe("Not authenticated")
    expect(from).not.toHaveBeenCalled()
  })

  it.each([null, undefined, { message: 42 }])(
    "returns the existing error response when client creation rejects with %p",
    async (error) => {
      jest.mocked(createClient).mockRejectedValueOnce(error)

      await expect(getRecords("00000000-0000-4000-8000-000000000300"))
        .resolves.toEqual({ records: null, error: "Failed to fetch records" })
    },
  )

  it("allows a validated category change through the authenticated client", async () => {
    const query: { eq: jest.Mock; is: jest.Mock; select: jest.Mock; single: jest.Mock; maybeSingle: jest.Mock } = {
      eq: jest.fn(() => query),
      is: jest.fn(() => query),
      select: jest.fn(() => query),
      single: jest.fn().mockResolvedValue({
        data: { id: recordId, category_id: categoryId },
        error: null,
      }),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: { site_id: siteId, category_id: categoryId, data: {}, relations: {}, status: "draft", updated_at: "2026-11-10T00:00:00Z" }, error: null })
        .mockResolvedValueOnce({ data: { id: categoryId, template_fields: [] }, error: null })
        .mockResolvedValueOnce({ data: { id: recordId, updated_at: "2026-11-10T00:00:01Z" }, error: null }),
    }
    const rpc = jest.fn(() => query)
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn(() => query),
      rpc,
    })

    const result = await updateRecord(recordId, { category_id: categoryId }, "2026-11-10T00:00:00Z")
    expect(result.error).toBeUndefined()
    expect(rpc).toHaveBeenCalledWith("save_record_at_template", {
      p_record_id: recordId, p_site_id: siteId, p_category_id: categoryId,
      p_updated_at: "2026-11-10T00:00:00Z", p_template_fields: [], p_changes: {},
    })
  })

  it("rejects record creation with an invalid configured field before insertion", async () => {
    const rpc = jest.fn()
    const query: { eq: jest.Mock; is: jest.Mock; select: jest.Mock; maybeSingle: jest.Mock } = {
      select: jest.fn(() => query), eq: jest.fn(() => query), is: jest.fn(() => query),
      maybeSingle: jest.fn().mockResolvedValue({ data: { template_fields: [
        { id: "quantity", name: "quantity", type: "number", min: 0 },
      ] }, error: null }),
    }
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) },
      from: jest.fn(() => query),
      rpc,
    } as never)
    const result = await createRecord({ site_id: siteId, category_id: categoryId, title: "Batch", data: { quantity: -1 } })
    expect(result.error).toMatch(/minimum/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it("rejects unknown writable fields in category metadata updates", async () => {
    const from = jest.fn()
    jest.mocked(createClient).mockResolvedValue({ from } as never)
    const result = await updateRecordCategory(categoryId, { site_id: siteId }, "2026-11-10T00:00:00Z")
    expect(result.error).toBeTruthy()
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects creation with a primary date that points to a non-date field", async () => {
    const from = jest.fn()
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } } }) }, from,
    } as never)
    const result = await createRecordCategory({ site_id: siteId, name: "Measurements",
      template_fields: [{ id: "count", name: "Count", type: "number" }], primary_date_field_id: "count" })
    expect(result.error).toMatch(/Choose a date field/)
    expect(from).not.toHaveBeenCalled()
  })

  it("does not orphan the primary date when a partial template update removes the field", async () => {
    const version = "2026-11-10T00:00:00Z"
    const query: { select: jest.Mock; eq: jest.Mock; update: jest.Mock; maybeSingle: jest.Mock } = {
      select: jest.fn(() => query), eq: jest.fn(() => query), update: jest.fn(() => query),
      maybeSingle: jest.fn().mockResolvedValue({ data: { site_id: siteId, updated_at: version,
        primary_date_field_id: "day", template_fields: [{ id: "day", name: "Day", type: "date" }] } }),
    }
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } } }) }, from: jest.fn(() => query),
    } as never)
    expect((await updateRecordCategory(categoryId, { template_fields: [] }, version)).error).toMatch(/Choose a date field/)
    expect(query.update).not.toHaveBeenCalled()
  })

  it.each(["stale tab", "late concurrent write", "concurrent template edit"])("rejects a %s without overwriting the newer version", async (scenario) => {
    const version = "2026-11-10T00:00:00.123456Z"
    const query: any = {
      select: jest.fn(() => query), eq: jest.fn(() => query), is: jest.fn(() => query),
      update: jest.fn(() => query),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: { site_id: siteId, category_id: categoryId, data: {}, relations: {}, status: "draft",
          updated_at: scenario === "stale tab" ? "2026-11-10T00:00:00.123457Z" : version }, error: null })
        .mockResolvedValueOnce({ data: { template_fields: [] }, error: null })
        .mockResolvedValueOnce({ data: null, error: scenario === "concurrent template edit" ? { code: "40001" } : null }),
    }
    const rpc = jest.fn(() => query)
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) },
      from: jest.fn(() => query),
      rpc,
    } as never)
    expect(await updateRecord(recordId, { title: "Stale title" }, version)).toMatchObject({ conflict: true })
    if (scenario === "stale tab") expect(rpc).not.toHaveBeenCalled()
    else expect(rpc).toHaveBeenCalledWith("save_record_at_template", expect.objectContaining({ p_updated_at: version }))
  })

  it("conditions the category update on the version originally opened by the editor", async () => {
    const version = "2026-11-10T00:00:00.123456Z"
    const query: any = {
      select: jest.fn(() => query), eq: jest.fn(() => query), update: jest.fn(() => query),
      maybeSingle: jest.fn()
        .mockResolvedValueOnce({ data: { site_id: siteId, template_fields: [], updated_at: version } })
        .mockResolvedValueOnce({ data: null, error: null }),
    }
    jest.mocked(createClient).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } } }) },
      from: jest.fn(() => query),
    } as never)
    expect(await updateRecordCategory(categoryId, { template_fields: [] }, version)).toMatchObject({ conflict: true })
    expect(query.eq).toHaveBeenCalledWith("updated_at", version)
  })

  it.each([undefined, "invalid"])("rejects a missing or invalid expected version (%s)", async (version) => {
    const result = await updateRecord(recordId, { title: "Title" }, version as string)
    expect(result.error).toBeTruthy()
    expect(createClient).not.toHaveBeenCalled()
  })
})
