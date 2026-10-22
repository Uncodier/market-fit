/** @jest-environment node */

import { registerBuyerVisit, registerVisit, type RegisterVisitInput } from "@/app/visits/actions"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))

type Row = Record<string, unknown>
type Query = { table: string; operation: string; filters: Row; payload?: Row }

const siteId = "visit-site"
const ownerId = "site-owner"
const staffId = "staff-user"
const buyerId = "buyer-user"
const input: RegisterVisitInput = {
  siteId,
  visitorName: "New Visitor",
  visitorEmail: " visitor@example.test ",
  visitorPhone: "+15551234567",
  resourceType: "location",
  locationId: "visit-location",
  durationMinutes: 90,
  termsAccepted: true,
}

function mockClient({
  userId = staffId,
  owner = ownerId as string | null,
  existingLeads = [] as Row[],
  activeMember = true,
  siteError = false,
  insertError = false,
} = {}) {
  const queries: Query[] = []
  const leads = [...existingLeads]
  const rowsByTable: Record<string, Row[]> = {
    sites: [{ id: siteId, user_id: owner }],
    site_members: activeMember ? [{ site_id: siteId, user_id: userId, status: "active" }] : [],
    settings: [{ site_id: siteId, visits: { require_signature: false, require_photo: false } }],
    locations: [{ id: input.locationId, site_id: siteId, is_active: true }],
    user_profiles: [{ id: buyerId, first_name: "Verified", last_name: "Buyer", email: "buyer@example.test" }],
    leads,
    reservations: [],
  }
  const from = jest.fn((table: string) => {
    const record: Query = { table, operation: "select", filters: {} }
    queries.push(record)
    const result = () => {
      if (table === "sites" && siteError) return { data: null, error: { message: "Private database failure" } }
      if (record.operation === "insert") {
        if (table === "leads" && !record.payload?.user_id) {
          return { data: null, error: { message: 'null value in column "user_id" of relation "leads" violates not-null constraint' } }
        }
        if (table === "leads" && insertError) return { data: null, error: { message: "Private insert failure" } }
        const row = { id: "created-lead", buyer_user_id: null, ...record.payload }
        rowsByTable[table].push(row)
        return { data: row, error: null }
      }
      const rows = (rowsByTable[table] || []).filter(row => Object.entries(record.filters).every(
        ([key, value]) => row[key] === value,
      ))
      if (record.operation === "update") rows.forEach(row => Object.assign(row, record.payload))
      return { data: rows[0] || null, error: null }
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
      ilike: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      maybeSingle: jest.fn(async () => result()),
      single: jest.fn(async () => result()),
      then: (fulfilled: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(fulfilled),
    }
    query.eq.mockImplementation((key: string, value: unknown) => { record.filters[key] = value; return query })
    query.ilike.mockImplementation((key: string, value: string) => { record.filters[key] = value; return query })
    query.insert.mockImplementation((payload: Row) => { record.operation = "insert"; record.payload = payload; return query })
    query.update.mockImplementation((payload: Row) => { record.operation = "update"; record.payload = payload; return query })
    return query
  })
  const supabase = {
    from,
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId, email: "session@example.test" } : null } }) },
  }
  jest.mocked(createClient).mockResolvedValue(supabase as never)
  return { queries, leads }
}

const leadInsert = (queries: Query[]) => queries.find(query => query.table === "leads" && query.operation === "insert")
const reservationInsert = (queries: Query[]) => queries.find(query => query.table === "reservations" && query.operation === "insert")

beforeEach(() => jest.clearAllMocks())

it("completes a physical visit with the site's owner as lead user_id, not the staff member", async () => {
  const { queries } = mockClient()
  const result = await registerVisit({ ...input, user_id: "forged-owner" } as RegisterVisitInput)

  expect(result).toHaveProperty("data.status", "completed")
  expect(leadInsert(queries)?.payload).toEqual({
    site_id: siteId,
    user_id: ownerId,
    name: "New Visitor",
    email: "visitor@example.test",
    phone: "+15551234567",
    status: "new",
    origin: "visit_registration",
  })
  expect(queries.find(query => query.table === "sites")?.filters).toEqual({ id: siteId })
  expect(reservationInsert(queries)?.payload).toMatchObject({ lead_id: "created-lead", buyer_user_id: null, channel: "physical" })
  expect(revalidatePath).toHaveBeenCalledWith("/visits")
  expect(createServiceClient).not.toHaveBeenCalled()
})

it("completes a buyer visit with separate trusted site-owner and buyer IDs", async () => {
  const { queries } = mockClient({ userId: buyerId, activeMember: false })
  const result = await registerBuyerVisit(input)

  expect(result).toHaveProperty("data.status", "completed")
  expect(leadInsert(queries)?.payload).toMatchObject({
    site_id: siteId,
    user_id: ownerId,
    buyer_user_id: buyerId,
    name: "Verified Buyer",
    email: "buyer@example.test",
    status: "new",
  })
  expect(reservationInsert(queries)?.payload).toMatchObject({ buyer_user_id: buyerId, channel: "online" })
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each(["physical", "buyer"])("reuses an existing lead without changing ownership: %s", async mode => {
  const { queries, leads } = mockClient({
    userId: mode === "buyer" ? buyerId : staffId,
    existingLeads: [{ id: "existing-lead", site_id: siteId, user_id: "original-owner", buyer_user_id: buyerId, email: "visitor@example.test" }],
  })
  const result = mode === "buyer" ? await registerBuyerVisit(input) : await registerVisit(input)

  expect(result).toHaveProperty("data.lead_id", "existing-lead")
  expect(leadInsert(queries)).toBeUndefined()
  expect(leads[0].user_id).toBe("original-owner")
})

it.each(["physical", "buyer"])("blocks new lead creation when the site owner is missing: %s", async mode => {
  const { queries } = mockClient({ userId: mode === "buyer" ? buyerId : staffId, owner: null })
  const result = mode === "buyer" ? await registerBuyerVisit(input) : await registerVisit(input)

  expect(result).toEqual({ error: "Could not resolve visit site owner" })
  expect(leadInsert(queries)).toBeUndefined()
  expect(reservationInsert(queries)).toBeUndefined()
})

it.each(["physical", "buyer"])("does not expose owner lookup errors or perform writes: %s", async mode => {
  const { queries } = mockClient({ userId: mode === "buyer" ? buyerId : staffId, siteError: true })
  const result = mode === "buyer" ? await registerBuyerVisit(input) : await registerVisit(input)

  expect(result).toEqual({ error: "Could not resolve visit site owner" })
  expect(leadInsert(queries)).toBeUndefined()
  expect(reservationInsert(queries)).toBeUndefined()
})

it.each(["physical", "buyer"])("stops before saving a visit if lead creation fails: %s", async mode => {
  const { queries } = mockClient({ userId: mode === "buyer" ? buyerId : staffId, insertError: true })
  const result = mode === "buyer" ? await registerBuyerVisit(input) : await registerVisit(input)

  expect(result).toEqual({ error: "Could not create visitor record" })
  expect(reservationInsert(queries)).toBeUndefined()
})

it.each(["physical", "buyer"])("requires authentication before any database query: %s", async mode => {
  const { queries } = mockClient({ userId: "" })
  const result = mode === "buyer" ? await registerBuyerVisit(input) : await registerVisit(input)

  expect(result).toEqual({ error: "Not logged in" })
  expect(queries).toHaveLength(0)
})

it("rejects a physical visit from a non-member before lead creation", async () => {
  const { queries } = mockClient({ activeMember: false })
  expect(await registerVisit(input)).toEqual({ error: "Not authorized for this site" })
  expect(leadInsert(queries)).toBeUndefined()
  expect(reservationInsert(queries)).toBeUndefined()
})

it("does not reuse a lead from another site", async () => {
  const { queries } = mockClient({ existingLeads: [{ id: "foreign-lead", site_id: "foreign-site" }] })
  expect(await registerVisit({ ...input, leadId: "foreign-lead" })).toEqual({ error: "Customer not found" })
  expect(leadInsert(queries)).toBeUndefined()
  expect(reservationInsert(queries)).toBeUndefined()
})

it("rejects a buyer-provided lead belonging to another buyer", async () => {
  const { queries } = mockClient({
    userId: buyerId,
    existingLeads: [{ id: "other-buyer-lead", site_id: siteId, buyer_user_id: "other-buyer" }],
  })
  expect(await registerBuyerVisit({ ...input, leadId: "other-buyer-lead" })).toEqual({ error: "Not authorized for this customer" })
  expect(leadInsert(queries)).toBeUndefined()
  expect(reservationInsert(queries)).toBeUndefined()
})