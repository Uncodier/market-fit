/** @jest-environment node */

import { resolveSiteInfoBySlug } from "@/app/book/site-by-slug"
import { createServiceClient } from "@/lib/supabase/server"

jest.mock("@/lib/supabase/server", () => ({ createServiceClient: jest.fn() }))

type Site = {
  id: string
  name: string
  logo_url: null
  archived_at: string | null
}

const siteId = "11111111-1111-4111-8111-111111111111"
const settings = { site_id: siteId, currency: "USD" }

function mockSites(sites: Site[]) {
  const siteQueries: any[] = []
  const from = jest.fn((table: string) => {
    const rows = table === "sites" ? sites : [settings]
    const filters: Array<(row: any) => boolean> = []
    const result = () => ({
      data: rows.filter((row) => filters.every((filter) => filter(row))),
      error: null,
    })
    const query: any = {
      select: jest.fn(() => query),
      eq: jest.fn((column, value) => {
        filters.push((row) => row[column] === value)
        return query
      }),
      is: jest.fn((column, value) => {
        filters.push((row) => row[column] === value)
        return query
      }),
      ilike: jest.fn((column, value) => {
        const pattern = new RegExp(`^${value.replace(/%/g, ".*")}$`, "i")
        filters.push((row) => pattern.test(row[column]))
        return query
      }),
      limit: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data: result().data[0] || null, error: null })),
      then: (resolve: (value: ReturnType<typeof result>) => unknown) =>
        Promise.resolve(result()).then(resolve),
    }
    if (table === "sites") siteQueries.push(query)
    return query
  })
  jest.mocked(createServiceClient).mockResolvedValue({ from } as any)
  return { from, siteQueries }
}

describe("resolveSiteInfoBySlug archive filtering", () => {
  beforeEach(() => jest.clearAllMocks())

  it.each([
    ["UUID", siteId, "Example", 1],
    ["exact name", "example", "Example", 1],
    ["prefix name", "example-shop", "Example Shop ", 2],
  ])("still resolves an active site by %s", async (_label, slug, name, queryCount) => {
    const { siteQueries } = mockSites([{ id: siteId, name, logo_url: null, archived_at: null }])

    expect(await resolveSiteInfoBySlug(slug)).toEqual(expect.objectContaining({
      id: siteId,
      name,
      settings,
    }))
    expect(createServiceClient).toHaveBeenCalledWith(true)
    expect(siteQueries).toHaveLength(queryCount)
    for (const query of siteQueries) {
      expect(query.is).toHaveBeenCalledWith("archived_at", null)
    }
  })

  it.each([
    ["UUID", siteId, "Example"],
    ["exact name", "example", "Example"],
    ["prefix name", "example-shop", "Example Shop "],
  ])("does not resolve an archived site by %s or load its settings", async (_label, slug, name) => {
    const { from, siteQueries } = mockSites([
      { id: siteId, name, logo_url: null, archived_at: "2026-09-22T10:00:00Z" },
    ])

    expect(await resolveSiteInfoBySlug(slug)).toBeNull()
    expect(from).not.toHaveBeenCalledWith("settings")
    for (const query of siteQueries) {
      expect(query.is).toHaveBeenCalledWith("archived_at", null)
    }
  })

  it.each([
    ["example", "Example"],
    ["example-shop", "Example Shop "],
  ])("ignores archived candidates sharing the %s slug", async (slug, name) => {
    mockSites([
      { id: "archived", name, logo_url: null, archived_at: "2026-09-22T10:00:00Z" },
      { id: siteId, name, logo_url: null, archived_at: null },
    ])

    expect(await resolveSiteInfoBySlug(slug)).toEqual(expect.objectContaining({ id: siteId }))
  })

  it("does not resolve an active prefix candidate whose normalized slug differs", async () => {
    const { from } = mockSites([
      { id: siteId, name: "Example Shop", logo_url: null, archived_at: null },
    ])

    expect(await resolveSiteInfoBySlug("example")).toBeNull()
    expect(from).not.toHaveBeenCalledWith("settings")
  })
})