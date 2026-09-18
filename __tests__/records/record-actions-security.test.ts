import { createClient } from "../../lib/supabase/server"
import {
  getRecords,
  updateRecord,
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

  it("allows a validated category change through the authenticated client", async () => {
    const update = jest.fn()
    const query: any = {
      update: jest.fn((value) => {
        update(value)
        return query
      }),
      eq: jest.fn(() => query),
      select: jest.fn(() => query),
      single: jest.fn().mockResolvedValue({
        data: { id: recordId, category_id: categoryId },
        error: null,
      }),
    }
    ;(createClient as jest.Mock).mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
      },
      from: jest.fn(() => query),
    })

    const result = await updateRecord(recordId, { category_id: categoryId })
    expect(result.error).toBeUndefined()
    expect(update).toHaveBeenCalledWith({ category_id: categoryId })
  })
})
