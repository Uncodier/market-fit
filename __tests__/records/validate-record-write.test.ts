import type { SupabaseClient } from "@supabase/supabase-js"
import { validateRecordWrite, type RecordWriteValues } from "@/app/records/lib/validate-record-write"

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const input: RecordWriteValues = { site_id: uuid(1), category_id: uuid(2), data: {}, relations: {}, status: "draft" }
const relation = (target: string) => ({ id: "link", name: "Link", type: "relation", relationTarget: target })
type Reply = { data: unknown; error?: unknown }
type MockQuery = {
  select: jest.Mock
  eq: jest.Mock
  is: jest.Mock
  or: jest.Mock
  limit: jest.Mock
  maybeSingle: jest.Mock
}
function client(fields: unknown[] | null, replies: Record<string, Reply> = {}, systemKey?: string) {
  const calls: Array<{ table: string; filters: unknown[][] }> = []
  const from = jest.fn((table: string) => {
    const filters: unknown[][] = []
    calls.push({ table, filters })
    let reply = table === "record_categories" ? { data: { id: input.category_id, template_fields: fields, system_key: systemKey } } : replies[table] ?? { data: null }
    const query: MockQuery = {
      select: jest.fn((projection: string) => {
        if (table === "record_categories" && projection === "id") reply = replies[table] ?? { data: null }
        return query
      }),
      eq: jest.fn((...args: unknown[]) => { filters.push(args); return query }),
      is: jest.fn((...args: unknown[]) => { filters.push(args); return query }),
      or: jest.fn((...args: unknown[]) => { filters.push(args); return query }),
      limit: jest.fn(() => Promise.resolve(reply)),
      maybeSingle: jest.fn(() => Promise.resolve(reply)),
    }
    return query
  })
  return { supabase: { from } as unknown as SupabaseClient, calls }
}

describe("record write validation", () => {
  it("allows incremental drafts, but requires values upon activation", async () => {
    const { supabase } = client([{ id: "x", name: "Count", type: "number", required: true }])
    expect((await validateRecordWrite(supabase, input)).valid).toBe(true)
    expect((await validateRecordWrite(supabase, input, input)).valid).toBe(true)
    expect((await validateRecordWrite(supabase, { ...input, status: "active" })).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...input, data: { Count: "bad" } })).valid).toBe(false)
  })
  it.each([["lead", "leads"], ["supplier", "suppliers"], ["sales_order", "sale_orders"]])("checks %s using %s and source site", async (target, table) => {
    const { supabase, calls } = client([relation(target)], { [table]: { data: { id: uuid(3) } } })
    expect((await validateRecordWrite(supabase, { ...input, relations: { Link: uuid(3) } })).valid).toBe(true)
    expect(calls.find(call => call.table === table)?.filters).toContainEqual(["site_id", input.site_id])
  })
  it("fails closed on invisible/missing foreign targets", async () => {
    const { supabase } = client([relation("lead")])
    expect((await validateRecordWrite(supabase, { ...input, relations: { Link: uuid(3) } })).valid).toBe(false)
  })
  it("uses the expected category for internal records", async () => {
    const { supabase, calls } = client([{ ...relation("record"), targetCategoryId: uuid(4) }], { records: { data: { id: uuid(3) } } })
    expect((await validateRecordWrite(supabase, { ...input, relations: { Link: uuid(3) } })).valid).toBe(true)
    expect(calls.find(call => call.table === "records")?.filters).toContainEqual(["category_id", uuid(4)])
  })
  it("rejects new person UUIDs without querying or reinterpreting them", async () => {
    const { supabase, calls } = client([relation("person")])
    const values = { ...input, relations: { Link: uuid(3) } }
    expect((await validateRecordWrite(supabase, values)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, values, values)).valid).toBe(true)
    expect(calls.every(call => call.table === "record_categories")).toBe(true)
  })
  it("requires both readable company and a readable site-linked business row", async () => {
    const values = { ...input, relations: { Link: uuid(3) } }
    const absent = client([relation("company")], { companies: { data: { id: uuid(3) } } })
    expect((await validateRecordWrite(absent.supabase, values)).valid).toBe(false)
    const linked = client([relation("company")], { companies: { data: { id: uuid(3) } }, suppliers: { data: [{ id: uuid(5) }] } })
    expect((await validateRecordWrite(linked.supabase, values)).valid).toBe(true)
    expect(linked.calls.find(call => call.table === "companies")?.filters).not.toContainEqual(["site_id", input.site_id])
  })
  it("uses active enabled membership user_id rather than row id", async () => {
    const { supabase, calls } = client([relation("team_member")], { site_members: { data: { user_id: uuid(3) } } })
    expect((await validateRecordWrite(supabase, { ...input, relations: { Link: uuid(3) } })).valid).toBe(true)
    expect(calls.find(call => call.table === "site_members")?.filters).toEqual(expect.arrayContaining([
      ["user_id", uuid(3)], ["status", "active"], ["manually_disabled.is.null,manually_disabled.eq.false"], ["license_suspended.is.null,license_suspended.eq.false"],
    ]))
  })
  it("preserves system metadata while denying forged undeclared relations", async () => {
    const { supabase } = client([], {}, "ai-feedback")
    expect((await validateRecordWrite(supabase, { ...input, data: { feedback_by: uuid(3) } })).valid).toBe(true)
    expect((await validateRecordWrite(supabase, { ...input, relations: { Forged: uuid(3) } })).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...input, relations: { Forged: [uuid(3)] } })).valid).toBe(false)
  })
  it("requires an active source category and active newly linked records", async () => {
    const { supabase, calls } = client([relation("record")], { records: { data: null } })
    expect((await validateRecordWrite(supabase, { ...input, relations: { Link: uuid(3) } })).valid).toBe(false)
    expect(calls.find(call => call.table === "record_categories")?.filters).toContainEqual(["deleted_at", null])
    expect(calls.find(call => call.table === "records")?.filters).toContainEqual(["deleted_at", null])
  })
  it("denies writes when the active category lookup hides a trashed category", async () => {
    const { supabase } = client([])
    const query = supabase.from("record_categories") as unknown as MockQuery
    jest.mocked(query.maybeSingle).mockResolvedValue({ data: null, error: null } as never)
    jest.mocked(supabase.from).mockReturnValue(query as never)
    expect(await validateRecordWrite(supabase, input, input)).toMatchObject({ valid: false,
      error: "Category not found or access denied" })
  })
  it.each(["team_member", "record", "record_category", "lead"])("preserves an unchanged historical %s without target revalidation, but rejects reassignment", async target => {
    const { supabase, calls } = client([relation(target)])
    const historical = { ...input, relations: { Link: uuid(3) } }
    expect((await validateRecordWrite(supabase, historical, historical)).valid).toBe(true)
    expect(calls.map(call => call.table)).toEqual(["record_categories"])
    expect((await validateRecordWrite(supabase, { ...historical, relations: { Link: uuid(4) } }, historical)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, historical)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...historical, site_id: uuid(5) }, historical)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...historical, category_id: uuid(5) }, historical)).valid).toBe(false)
  })
  it("only preserves undeclared data when unchanged on ordinary categories", async () => {
    const { supabase } = client([])
    const legacy = { ...input, data: { Legacy: { nested: true } } }
    expect((await validateRecordWrite(supabase, legacy)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, legacy, legacy)).valid).toBe(true)
  })
  it("treats nullable legacy columns/templates as empty without skipping required fields", async () => {
    const nullable = { ...input, data: null, relations: null }
    expect((await validateRecordWrite(client(null).supabase, nullable, nullable)).valid).toBe(true)
    expect(nullable.data).toBeNull()
    expect(nullable.relations).toBeNull()
    const required = client([{ id: "x", name: "Count", type: "number", required: true }])
    expect((await validateRecordWrite(required.supabase, { ...nullable, status: "active" }, nullable)).valid).toBe(false)
    for (const value of [[], false, 0, "", undefined]) {
      expect((await validateRecordWrite(client([]).supabase, { ...input, data: value })).valid).toBe(false)
      expect((await validateRecordWrite(client([]).supabase, { ...input, relations: value })).valid).toBe(false)
    }
  })
  it("preserves opaque legacy relations only in the original site/category", async () => {
    const values = { ...input, relations: { Historical: "opaque legacy link" } }
    const { supabase } = client([])
    expect((await validateRecordWrite(supabase, values, values)).valid).toBe(true)
    expect((await validateRecordWrite(supabase, { ...values, category_id: uuid(4) }, values)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...values, site_id: uuid(4) }, values)).valid).toBe(false)
    expect((await validateRecordWrite(supabase, { ...values, relations: { Historical: null } }, values)).valid).toBe(true)
  })
})