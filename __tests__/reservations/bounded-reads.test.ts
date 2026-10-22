jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/auth/site-role-lookup", () => ({ lookupCurrentUserSiteRole: jest.fn() }))

import { createClient } from "@/lib/supabase/server"
import { lookupCurrentUserSiteRole } from "@/lib/auth/site-role-lookup"
import { getReservations } from "@/app/reservations/actions"
import { getCalendarBlocks } from "@/app/reservations/calendar-blocks-actions"

const window = { start: "2026-10-01T00:00:00Z", end: "2026-11-01T00:00:00Z" }
const reservation = (id = "res", extra = {}) => ({ id, site_id: "site", status: "confirmed", start_time: "2026-10-14T12:00:00Z", end_time: "2026-10-14T13:00:00Z", ...extra })
type Row = Record<string, unknown>
type Result = { data: Row[] | null; error: { message: string } | null }
type Chain = Record<string, jest.Mock> & { then: (resolve: (result: Result) => unknown) => Promise<unknown> }
let rows: Record<string, Row[]>, failures: Record<string, boolean>, chains: Record<string, Chain[]>
let db: { from: jest.Mock; auth: { getUser: jest.Mock } }

function builder(table: string) {
  let from = 0, to = 499
  const filters: ((row: Row) => boolean)[] = []
  const query = {
    select: jest.fn(() => query), order: jest.fn(() => query), abortSignal: jest.fn(() => query), overrideTypes: jest.fn(() => query),
    eq: jest.fn((column, value) => { filters.push(row => row[column] === value); return query }),
    not: jest.fn((column) => { filters.push(row => row[column] != null); return query }),
    lt: jest.fn((column, value) => { filters.push(row => Date.parse(String(row[column])) < Date.parse(value)); return query }),
    gt: jest.fn((column, value) => { filters.push(row => Date.parse(String(row[column])) > Date.parse(value)); return query }),
    gte: jest.fn(() => query), lte: jest.fn(() => query),
    or: jest.fn(value => { const end = value.split("end_time.gt.")[1]; filters.push(row => row.end_time == null || Date.parse(String(row.end_time)) > Date.parse(end)); return query }),
    in: jest.fn((column, ids) => { filters.push(row => ids.includes(row[column])); return query }),
    range: jest.fn((start, end) => { from = start; to = end; return query }),
    then: (resolve: (result: Result) => unknown) => Promise.resolve(resolve({
      data: failures[table] ? null : (rows[table] || []).filter(row => filters.every(filter => filter(row))).slice(from, to + 1),
      error: failures[table] ? { message: "offline" } : null,
    })),
  } as unknown as Chain
  ;(chains[table] ||= []).push(query)
  return query
}

beforeEach(() => {
  rows = { reservations: [reservation()] }; failures = {}; chains = {}
  db = { from: jest.fn(builder), auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user" } }, error: null }) } }
  ;(createClient as jest.Mock).mockResolvedValue(db)
  ;(lookupCurrentUserSiteRole as jest.Mock).mockResolvedValue("owner")
})

it("validates before any database read and denies unauthenticated/foreign-site callers", async () => {
  expect((await getReservations("site", { start: "bad", end: "bad" })).error).toBeTruthy()
  expect(db.from).not.toHaveBeenCalled()
  db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
  expect((await getReservations("site", window)).error).toBe("Unauthorized")
  ;(lookupCurrentUserSiteRole as jest.Mock).mockResolvedValueOnce(null)
  expect((await getReservations("foreign", window)).error).toBe("Forbidden")
  expect(db.from).not.toHaveBeenCalled()
})

it("uses strict overlap, scopes all source reads and returns more than a provider page", async () => {
  rows.reservations = Array.from({ length: 1001 }, (_, i) => reservation(`r${i}`))
  rows.reservations.push(reservation("spanning", { start_time: "2020-01-01T00:00:00Z", end_time: "2027-01-01T00:00:00Z" }), reservation("open", { end_time: null }), reservation("foreign", { site_id: "foreign" }), reservation("before", { end_time: window.start }), reservation("after", { start_time: window.end }))
  const result = await getReservations("site", window)
  expect(result.error).toBeUndefined()
  expect(result.data).toHaveLength(1003)
  expect(chains.reservations.map(q => q.range.mock.calls[0])).toEqual([[0, 499], [500, 999], [1000, 1499]])
  expect(chains.reservations[0].lt).toHaveBeenCalledWith("start_time", "2026-11-01T00:00:00.000Z")
  expect(chains.tasks[0].eq).toHaveBeenCalledWith("site_id", "site")
  expect(chains.tasks[0].gt).not.toHaveBeenCalled()
})

it("preserves old unwindowed callers without an arbitrary date or total limit", async () => {
  rows.reservations.push(reservation("future", { start_time: "2030-01-01T00:00:00Z" }))
  const result = await getReservations("site")
  expect(result.data).toHaveLength(2)
  expect(chains.reservations[0].lt).not.toHaveBeenCalled()
  expect(chains.tasks[0].lt).not.toHaveBeenCalled()
})

it("maps long legacy/metadata tasks safely and retains UI original fields", async () => {
  rows.tasks = [
    { id: "long", site_id: "site", assignee: "user", scheduled_date: "2020-01-01T00:00:00Z", title: "Long task", type: "visit", metadata: { _calendar_context: { end_time: "2027-01-01T00:00:00Z", catalog_item_name: "Resource", location: "Office" } }, description: "Notes" },
    { id: "legacy", site_id: "site", assignee: "user", scheduled_date: "2026-10-14T12:00:00Z", title: "Legacy", description: JSON.stringify({ notes: "Keep", _calendar_context: { duration: "2 hours" } }) },
    { id: "past", site_id: "site", assignee: "user", scheduled_date: "2020-01-01T00:00:00Z" },
    { id: "unassigned", site_id: "site", scheduled_date: "2026-10-14T12:00:00Z" },
  ]
  const result = await getReservations("site", window)
  expect(result.error).toBeUndefined()
  expect(result.data.map(row => row.id)).toEqual(["task_long", "res", "task_legacy"])
  expect(result.data.find(row => row.id === "task_long")).toMatchObject({ original_task_id: "long", original_task_type: "visit", assignee_user_id: "user", notes: "Notes\n\nLocation: Office", end_time: "2027-01-01T00:00:00.000Z" })
  expect(result.data.find(row => row.id === "task_legacy")).toMatchObject({ notes: "Keep", end_time: "2026-10-14T14:00:00.000Z" })
})

it("preserves buyer and payment data with referenced ID batches only", async () => {
  rows.reservations = Array.from({ length: 501 }, (_, i) => reservation(`r${i}`, { buyer_user_id: `u${i}`, sale_order_item_id: `i${i}` }))
  rows.profiles = Array.from({ length: 501 }, (_, i) => ({ id: `u${i}`, name: `Buyer ${i}`, avatar_url: "avatar" }))
  rows.sale_order_items = Array.from({ length: 501 }, (_, i) => ({ id: `i${i}`, site_id: "site", sale_order_id: `o${i}` }))
  rows.sale_orders = Array.from({ length: 501 }, (_, i) => ({ id: `o${i}`, site_id: "site", sale_id: `s${i}` }))
  rows.sales = Array.from({ length: 501 }, (_, i) => ({ id: `s${i}`, site_id: "site", amount: 100, amount_due: 25 }))
  const result = await getReservations("site", window)
  expect(result.data[500]).toMatchObject({ buyer_profile: { name: "Buyer 500" }, sale_order_id: "o500", amount: 100, amount_due: 25 })
  for (const table of ["profiles", "sale_order_items", "sale_orders", "sales"]) {
    expect(Math.max(...chains[table].map(q => q.in.mock.calls[0][1].length))).toBe(500)
    if (table !== "profiles") expect(chains[table][0].eq).toHaveBeenCalledWith("site_id", "site")
  }
})

it("does not enrich linked payments from another site even for a multi-site user", async () => {
  rows.reservations = [reservation("r", { sale_order_item_id: "i" })]
  rows.sale_order_items = [{ id: "i", site_id: "foreign", sale_order_id: "o" }]
  rows.sale_orders = [{ id: "o", site_id: "foreign", sale_id: "s" }]
  rows.sales = [{ id: "s", site_id: "foreign", amount: 900, amount_due: 800 }]
  const result = await getReservations("site", window)
  expect(result.data[0]).toMatchObject({ sale_order_id: null, amount: null, amount_due: null })
  expect(db.from).not.toHaveBeenCalledWith("sales")
})

it.each(["reservations", "tasks", "profiles", "sale_order_items", "sale_orders", "sales"])("fails closed on %s errors", async table => {
  rows.reservations = [reservation("r", { buyer_user_id: "u", sale_order_item_id: "i" })]
  rows.sale_order_items = [{ id: "i", site_id: "site", sale_order_id: "o" }]; rows.sale_orders = [{ id: "o", site_id: "site", sale_id: "s" }]
  failures[table] = true
  const result = await getReservations("site", window)
  expect(result.error).toBeTruthy()
  expect(result.data).toEqual([])
})

it("bounds blocks, preserves unwindowed calls, and fails closed", async () => {
  rows.calendar_blocks = [reservation("overlap", { start_time: "2020-01-01T00:00:00Z" }), reservation("open", { end_time: null }), reservation("boundary", { end_time: window.start }), reservation("foreign", { site_id: "foreign" })]
  expect((await getCalendarBlocks("site", window)).data.map(row => row.id)).toEqual(["overlap", "open"])
  expect((await getCalendarBlocks("site")).data).toHaveLength(3)
  failures.calendar_blocks = true
  expect((await getCalendarBlocks("site", window)).error).toBeTruthy()
})