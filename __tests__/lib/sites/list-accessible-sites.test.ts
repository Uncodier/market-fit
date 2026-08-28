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
        { id: "owned", name: "Owned", user_id: "user-1" },
        { id: "member", name: "Member", user_id: "other" },
        { id: "co-owned", name: "Co-owned", user_id: "other" },
        { id: "other", name: "Other", user_id: "other" },
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
      sites: [{ id: "owned", user_id: "user-1" }],
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
})
