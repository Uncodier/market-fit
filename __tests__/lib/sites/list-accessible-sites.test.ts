import { listAccessibleSitesForUser, mergeAccessibleSites, SITE_LIST_COLUMNS } from "@/lib/sites/list-accessible-sites"

function fakeAdmin(tables: Record<string, any[]>, trackSelects: string[] = []) {
  return {
    from(table: string) {
      const rows = tables[table] || []
      const filters: Array<(row: any) => boolean> = []
      const builder: any = {
        select: (cols: string) => {
          if (table === "sites") trackSelects.push(cols)
          return builder
        },
        eq: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        in: (column: string, values: unknown[]) => {
          filters.push((row) => values.includes(row[column]))
          return builder
        },
        is: (column: string, value: unknown) => {
          filters.push((row) => row[column] === value)
          return builder
        },
        then: (resolve: (value: { data: any[]; error: null }) => unknown) =>
          Promise.resolve({ data: rows.filter((row) => filters.every((filter) => filter(row))), error: null }).then(
            resolve
          ),
      }
      return builder
    },
  }
}

describe("mergeAccessibleSites", () => {
  it("dedupes by id and keeps the last copy", () => {
    expect(
      mergeAccessibleSites(
        [{ id: "a", name: "Owned" }],
        [{ id: "a", name: "Member" }, { id: "b", name: "Extra" }]
      )
    ).toEqual([
      { id: "a", name: "Member" },
      { id: "b", name: "Extra" },
    ])
  })
})

describe("listAccessibleSitesForUser", () => {
  it("returns owned sites plus active memberships and ownership rows", async () => {
    const admin = fakeAdmin({
      sites: [
        { id: "owned", name: "Owned", user_id: "user-1", archived_at: null },
        { id: "member", name: "Member", user_id: "other", archived_at: null },
        { id: "co-owned", name: "Co-owned", user_id: "other", archived_at: null },
        { id: "other", name: "Other", user_id: "other", archived_at: null },
      ],
      site_members: [
        { site_id: "member", user_id: "user-1", status: "active" },
        { site_id: "pending", user_id: "user-1", status: "pending" },
      ],
      site_ownership: [{ site_id: "co-owned", user_id: "user-1" }],
    })

    const { sites, error } = await listAccessibleSitesForUser(admin, "user-1")
    expect(error).toBeNull()
    expect(sites.map((site) => site.id).sort()).toEqual(["co-owned", "member", "owned"])
  })

  it("uses slim columns to avoid fetching heavy fields like base64 logos", async () => {
    const trackSelects: string[] = []
    const admin = fakeAdmin({
      sites: [{ id: "owned", user_id: "user-1", archived_at: null }],
      site_members: [],
      site_ownership: []
    }, trackSelects)
    
    await listAccessibleSitesForUser(admin, "user-1")
    
    expect(trackSelects.length).toBeGreaterThan(0)
    for (const cols of trackSelects) {
      expect(cols).toBe(SITE_LIST_COLUMNS)
      expect(cols).not.toContain("logo_url")
      expect(cols).not.toContain("*")
    }
  })

  it("excludes archived owned, member, and co-owned sites without changing relationships", async () => {
    const archived_at = "2026-09-22T10:00:00Z"
    const tables = {
      sites: [
        { id: "active", user_id: "user-1", archived_at: null },
        { id: "owned", user_id: "user-1", archived_at },
        { id: "member", user_id: "other", archived_at },
        { id: "co-owned", user_id: "other", archived_at },
      ],
      site_members: [
        { site_id: "owned", user_id: "user-1", status: "active" },
        { site_id: "member", user_id: "user-1", status: "active" },
      ],
      site_ownership: [{ site_id: "co-owned", user_id: "user-1" }],
    }
    const before = JSON.stringify(tables)

    const result = await listAccessibleSitesForUser(fakeAdmin(tables), "user-1")

    expect(result).toEqual({ sites: [tables.sites[0]], error: null })
    expect(JSON.stringify(tables)).toBe(before)
  })
})
