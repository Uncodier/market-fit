/** @jest-environment node */

import { NextRequest } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { GET as performance } from "@/app/api/dashboard/performance/route"
import { GET as metricsOverview } from "@/app/api/performance/metrics-overview/route"
import { createClient, createServiceClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock("@/lib/redis/control-plane", () => ({
  checkRateLimit: jest.fn(async () => ({ allowed: true })),
  hashRedisKeyPart: jest.fn(async (value: string) => value),
}))
jest.mock("@/lib/redis/json-cache", () => ({
  normalizedRequestCacheKey: jest.fn(async () => "test-cache"),
  readThroughJsonCache: jest.fn(async ({ compute }) => ({ status: "computed", value: await compute() })),
}))

const siteId = "00000000-0000-4000-8000-000000000001"
const segmentId = "00000000-0000-4000-8000-000000000002"
const createdAt = "2026-09-10T23:30:00.000Z"
const urls: URL[] = []
const schemaErrors: string[] = []
let failingTable: string | undefined

// Match the connected schema: sites has no timezone, and conversations/tasks
// relate to segments through leads rather than owning a segment_id column.
const columns: Record<string, string[]> = {
  sites: ["id", "name"],
  leads: ["id", "created_at", "site_id", "segment_id"],
  conversations: ["id", "created_at", "site_id", "lead_id"],
  tasks: ["id", "created_at", "scheduled_date", "site_id", "lead_id", "type", "stage"],
  sales: ["id", "created_at", "site_id", "segment_id"],
}

function selectedColumns(select: string): string[] {
  let depth = 0
  let field = ""
  const fields: string[] = []
  for (const character of `${select},`) {
    if (character === "," && depth === 0) {
      if (field && !field.includes("(")) fields.push(field)
      field = ""
    } else {
      field += character
      if (character === "(") depth++
      if (character === ")") depth--
    }
  }
  return fields
}

const restFetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input))
  urls.push(url)
  const table = url.pathname.split("/").at(-1)!
  const select = url.searchParams.get("select") ?? "*"
  const filters = Array.from(url.searchParams.keys()).filter(key =>
    !["select", "or", "order", "offset", "limit"].includes(key) && !key.includes(".")
  )
  const missing = [...selectedColumns(select), ...filters].find(column => !columns[table]?.includes(column))
  if (missing) {
    const message = `column ${table}.${missing} does not exist`
    schemaErrors.push(message)
    return Response.json({ code: "42703", message }, { status: 400 })
  }
  if (table === failingTable) {
    return Response.json({ code: "57014", message: "private database details" }, { status: 500 })
  }

  const bounds = Array.from(url.searchParams.values()).filter(value => /^(gte|lte)\./.test(value))
  const inPeriod = bounds.every(bound => {
    const date = bound.slice(4)
    return bound.startsWith("gte.") ? createdAt >= date : createdAt <= date
  })
  const row = { id: `${table}-1`, created_at: createdAt, scheduled_date: createdAt }
  const leads = ["lead-1", "lead-2"].map(id => ({
    id, created_at: createdAt,
    conversations: [{ messages: [{ id: `message-${id}`, created_at: createdAt, role: "user" }] }],
  }))
  const data = inPeriod ? (table === "leads" ? leads : [row]) : []
  if (init?.method === "HEAD") {
    return new Response(null, { headers: { "Content-Range": `*/${data.length}` } })
  }
  return Response.json(data)
})

function request(group = "outcomes", segment = "all") {
  return new NextRequest(`https://example.test/api/dashboard/performance?${new URLSearchParams({
    siteId, segmentId: segment, startDate: "2026-08-29", endDate: "2026-09-29", group,
  })}`, { headers: { cookie: "session=test" } })
}

beforeEach(() => {
  jest.clearAllMocks()
  urls.length = 0
  schemaErrors.length = 0
  failingTable = undefined
  jest.spyOn(console, "error").mockImplementation(() => {})
  ;(createClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: "member" } }, error: null })) },
    rpc: jest.fn(async () => ({ data: "owner", error: null })),
  })
  // Exercise the real SDK's URL generation and all real outcome handlers.
  ;(createServiceClient as jest.Mock).mockResolvedValue(createSupabaseClient(
    "https://database.example.test", "test-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: restFetch },
    }
  ))
})

afterEach(() => { jest.restoreAllMocks() })

it("loads an existing account's nonzero outcomes without a sites.timezone column", async () => {
  const response = await performance(request())
  expect(schemaErrors).toEqual([])
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    "leads-contacted": { actual: 2 },
    "leads-in-conversation": { actual: 2 },
    meetings: { actual: 1 },
    sales: { actual: 1 },
    "metrics-overview": {
      actual: 8,
      chartData: expect.arrayContaining([{
        date: "2026-09-10", leadsCreated: 2, conversations: 1, engagement: 2, tasks: 1, meetings: 1, sales: 1,
      }]),
    },
  })
  expect(urls.some(url => url.pathname.endsWith("/sites"))).toBe(false)
  for (const url of urls) expect(url.searchParams.get("site_id")).toBe(`eq.${siteId}`)
})

it("filters chart conversations and tasks through their lead's segment", async () => {
  const response = await metricsOverview(request("outcomes", segmentId))
  expect(schemaErrors).toEqual([])
  expect(response.status).toBe(200)
  for (const table of ["conversations", "tasks"]) {
    const queries = urls.filter(url => url.pathname.endsWith(`/${table}`))
    expect(queries.length).toBeGreaterThanOrEqual(2)
    for (const url of queries) {
      expect(url.searchParams.has("segment_id")).toBe(false)
      expect(url.searchParams.get("leads.segment_id")).toBe(`eq.${segmentId}`)
      expect(url.searchParams.get("select")).toContain("leads!inner(")
    }
  }
})

it("does not disguise a real query failure as successful zero activity", async () => {
  failingTable = "sales"
  const response = await performance(request())
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: "Failed to load performance metrics" })
})