import { assignableSiteMembers } from "@/lib/auth/assignable-site-members"
import { employeeMembers, siteMember } from "@/__tests__/fixtures/site-members"

describe("assignable employee options", () => {
  it("excludes disabled, suspended, pending, rejected and unregistered employees", () => {
    expect(assignableSiteMembers(employeeMembers)).toEqual([employeeMembers[0]])
  })

  it.each([
    { manually_disabled: true, license_suspended: false },
    { manually_disabled: false, license_suspended: true },
    { manually_disabled: true, license_suspended: true },
  ])("excludes inactive employees independently of the active status: %j", flags => {
    expect(assignableSiteMembers([siteMember(flags)])).toEqual([])
  })

  it("keeps enabled owners, admins, marketing members and collaborators", () => {
    const members = (["owner", "admin", "marketing", "collaborator"] as const)
      .map(role => siteMember({ id: role, user_id: role, role }))
    expect(assignableSiteMembers(members)).toEqual(members)
  })

  it("deduplicates only eligible user IDs and does not modify retained records", () => {
    const enabled = siteMember({ manually_disabled: false, license_suspended: false })
    const disabled = siteMember({ manually_disabled: true })
    const members = Object.freeze([disabled, enabled, { ...enabled, id: "duplicate-row" }])
    const result = assignableSiteMembers([...members])
    expect(result).toEqual([enabled])
    expect(result[0]).toBe(enabled)
    expect(members[0].manually_disabled).toBe(true)
    expect(members).toHaveLength(3)
  })

  it("restores the same employee after reactivation", () => {
    const member = siteMember({ manually_disabled: true, license_suspended: true })
    expect(assignableSiteMembers([member])).toEqual([])
    expect(assignableSiteMembers([{ ...member, manually_disabled: false, license_suspended: false }]))
      .toEqual([{ ...member, manually_disabled: false, license_suspended: false }])
  })
})
