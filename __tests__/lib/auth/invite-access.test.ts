import {
  canManageTeamMembers,
  parseWritableSiteMemberRole,
  siteMemberRoleToInvitationRole,
} from "@/lib/auth/screen-access"
import {
  formRoleToInvitationRole,
  formRoleToSiteMemberRole,
  isValidTeamEmail,
} from "@/app/components/settings/team-types"
import { inferButtonCommand } from "@/lib/permissions/button-heuristic"
import { assignableSiteMembers } from "@/lib/auth/assignable-site-members"
import {
  isInviteEmailError,
  siteMembersService,
} from "@/app/services/site-members-service"

describe("invite access", () => {
  it("allows owners and admins to manage team members", () => {
    expect(canManageTeamMembers(true, null)).toBe(true)
    expect(canManageTeamMembers(false, "admin")).toBe(true)
    expect(canManageTeamMembers(false, "owner")).toBe(true)
  })

  it("denies collaborators and viewers", () => {
    expect(canManageTeamMembers(false, "collaborator")).toBe(false)
    expect(canManageTeamMembers(false, "marketing")).toBe(false)
  })

  it("rejects assigning owner through the writable role parser", () => {
    expect(parseWritableSiteMemberRole("owner")).toBeNull()
    expect(parseWritableSiteMemberRole("view")).toBeNull()
    expect(parseWritableSiteMemberRole("admin")).toBe("admin")
    expect(parseWritableSiteMemberRole("marketing")).toBe("marketing")
    expect(parseWritableSiteMemberRole("collaborator")).toBe("collaborator")
  })
})

describe("invite role mapping", () => {
  it("maps stored site_members roles to magic-link invitation roles", () => {
    expect(siteMemberRoleToInvitationRole("admin")).toBe("admin")
    expect(siteMemberRoleToInvitationRole("collaborator")).toBe("create")
    expect(siteMemberRoleToInvitationRole("marketing")).toBe("view")
  })

  it("keeps form roles consistent with invitation roles", () => {
    expect(formRoleToSiteMemberRole("admin")).toBe("admin")
    expect(formRoleToSiteMemberRole("create")).toBe("collaborator")
    expect(formRoleToSiteMemberRole("delete")).toBe("collaborator")
    expect(formRoleToSiteMemberRole("view")).toBe("marketing")
    expect(formRoleToInvitationRole("admin")).toBe("admin")
    expect(formRoleToInvitationRole("create")).toBe("create")
    expect(formRoleToInvitationRole("delete")).toBe("create")
    expect(formRoleToInvitationRole("view")).toBe("view")
  })
})

describe("pending member cleanup", () => {
  it("rejects placeholder emails that were saved as values", () => {
    expect(isValidTeamEmail("Professional email address")).toBe(false)
    expect(isValidTeamEmail("Full name of team member")).toBe(false)
    expect(isValidTeamEmail("ada@example.com")).toBe(true)
  })

  it("does not treat team remove confirms as a data-delete when allowed", () => {
    expect(
      inferButtonCommand({
        variant: "default",
        tint: "destructive",
        childrenText: "Remove Member",
      })
    ).toBe("delete")
    expect(
      inferButtonCommand({
        variant: "default",
        tint: "destructive",
        childrenText: "Remove Member",
        dataPermission: "allow",
      })
    ).toBeNull()
  })
})

describe("assignableSiteMembers", () => {
  it("includes active collaborators with a user id, not only the current owner", () => {
    const result = assignableSiteMembers([
      {
        id: "owner-row",
        site_id: "makinari",
        user_id: "sergio",
        role: "owner",
        added_by: null,
        created_at: "",
        updated_at: "",
        email: "sergio@uncodie.com",
        name: "Sergio Prado",
        position: null,
        status: "active",
      },
      {
        id: "ale-row",
        site_id: "makinari",
        user_id: "ale",
        role: "collaborator",
        added_by: "sergio",
        created_at: "",
        updated_at: "",
        email: "ale@uncodie.com",
        name: "Alejandra Barragán Contreras",
        position: "COO",
        status: "active",
      },
      {
        id: "placeholder",
        site_id: "makinari",
        user_id: null,
        role: "collaborator",
        added_by: "sergio",
        created_at: "",
        updated_at: "",
        email: "Professional email address",
        name: "Full name of team member",
        position: null,
        status: "pending",
      },
    ])

    expect(result.map((member) => member.email)).toEqual([
      "sergio@uncodie.com",
      "ale@uncodie.com",
    ])
  })
})

describe("addMember invitation errors", () => {
  const memberRow = {
    id: "m1",
    site_id: "site-1",
    email: "ada@example.com",
    role: "admin",
    status: "pending",
  }

  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockReset()
  })

  it("rethrows rate-limit after the member row exists", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, member: memberRow }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: "Too many emails sent. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: 60,
        }),
      })

    try {
      await siteMembersService.addMember("site-1", {
        email: "ada@example.com",
        role: "admin",
      })
      throw new Error("expected InviteEmailError")
    } catch (error) {
      expect(isInviteEmailError(error)).toBe(true)
      if (isInviteEmailError(error)) {
        expect(error.member.id).toBe("m1")
        expect(error.message).toMatch(/Rate limit exceeded/)
      }
    }
  })

  it("does not swallow generic invite send failures", async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, member: memberRow }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "SMTP down" }),
      })

    await expect(
      siteMembersService.addMember("site-1", {
        email: "ada@example.com",
        role: "admin",
      })
    ).rejects.toMatchObject({ name: "InviteEmailError", message: "SMTP down" })
  })
})
