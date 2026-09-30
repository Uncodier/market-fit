/** @jest-environment node */

import { copywritingService } from "@/app/context/copywriting-actions"
import { createClient } from "@/lib/supabase/client"
import type { CopywritingItem } from "@/app/components/settings/form-schema"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}))

const item = (id: string, title: string): CopywritingItem & { id: string; site_id: string; user_id: string } => ({
  id, title, content: "Content", copy_type: "tweet", status: "draft", site_id: "site-1", user_id: "user-1",
})

function setup(rows: ReturnType<typeof item>[]) {
  const writes: { operation: string; value: unknown }[] = []
  const from = jest.mocked(createClient).mock.results[0].value.from as jest.Mock
  from.mockImplementation(() => {
    type Query = {
      select: jest.Mock
      eq: jest.Mock
      in: jest.Mock
      order: jest.Mock
      insert: jest.Mock<Query, [unknown]>
      update: jest.Mock<Query, [unknown]>
      delete: jest.Mock<Query, []>
      then: (resolve: (value: { data: ReturnType<typeof item>[]; error: null }) => unknown) => Promise<unknown>
    }
    const query: Query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn((value: unknown) => { writes.push({ operation: "insert", value }); return query }),
      update: jest.fn((value: unknown) => { writes.push({ operation: "update", value }); return query }),
      delete: jest.fn(() => { writes.push({ operation: "delete", value: null }); return query }),
      then: (resolve: (value: { data: ReturnType<typeof item>[]; error: null }) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
    }
    return query
  })
  return writes
}

describe("copywriting sync contracts", () => {
  it("preserves temporarily empty existing items without updating or deleting them", async () => {
    const existing = item("copy-1", "Saved title")
    const writes = setup([existing])
    await expect(copywritingService.syncCopywritingItems("site-1", "user-1", [
      { ...existing, title: "", content: "" },
    ])).resolves.toEqual({ success: true })
    expect(writes).toEqual([])
  })

  it("rejects a renamed duplicate before writing", async () => {
    const first = item("copy-1", "First")
    const writes = setup([first, item("copy-2", "Second")])
    const result = await copywritingService.syncCopywritingItems("site-1", "user-1", [{ ...first, title: "Second" }])
    expect(result.success).toBe(false)
    expect(result.error).toContain("already exists")
    expect(writes).toEqual([])
  })

  it("updates existing title matches instead of inserting duplicates", async () => {
    const existing = item("copy-1", "Saved title")
    const writes = setup([existing])
    const input = { ...existing, id: undefined }
    await expect(copywritingService.syncCopywritingItems("site-1", "user-1", [input]))
      .resolves.toEqual({ success: true })
    expect(writes.map(write => write.operation)).toEqual(["update"])
  })
})