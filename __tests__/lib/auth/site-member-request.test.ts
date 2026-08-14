import { canManageTeamMembers, parseWritableSiteMemberRole } from "@/lib/auth/screen-access"

describe("parseWritableSiteMemberRole", () => {
  it("accepts admin, marketing, and collaborator", () => {
    expect(parseWritableSiteMemberRole("admin")).toBe("admin")
    expect(parseWritableSiteMemberRole("marketing")).toBe("marketing")
    expect(parseWritableSiteMemberRole("collaborator")).toBe("collaborator")
  })

  it("rejects owner and unknown values", () => {
    expect(parseWritableSiteMemberRole("owner")).toBeNull()
    expect(parseWritableSiteMemberRole("view")).toBeNull()
    expect(parseWritableSiteMemberRole(null)).toBeNull()
  })
})

describe("canManageTeamMembers", () => {
  it("allows site owners and admins only", () => {
    expect(canManageTeamMembers(true, null)).toBe(true)
    expect(canManageTeamMembers(false, "admin")).toBe(true)
    expect(canManageTeamMembers(false, "owner")).toBe(true)
    expect(canManageTeamMembers(false, "collaborator")).toBe(false)
    expect(canManageTeamMembers(false, "marketing")).toBe(false)
  })
})
