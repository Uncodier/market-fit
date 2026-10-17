import type { SiteMember } from "@/app/services/site-members-service"

export function siteMember(overrides: Partial<SiteMember> = {}): SiteMember {
  return {
    id: "active-row",
    site_id: "site-one",
    user_id: "active-user",
    role: "collaborator",
    added_by: null,
    created_at: "",
    updated_at: "",
    email: "active@example.test",
    name: "Active Employee",
    position: null,
    status: "active",
    manually_disabled: false,
    license_suspended: false,
    ...overrides,
  }
}

export const employeeMembers = [
  siteMember(),
  siteMember({ id: "disabled-row", user_id: "disabled-user", name: "Disabled Employee", manually_disabled: true }),
  siteMember({ id: "suspended-row", user_id: "suspended-user", name: "Suspended Employee", license_suspended: true }),
  siteMember({ id: "pending-row", user_id: "pending-user", name: "Pending Employee", status: "pending" }),
  siteMember({ id: "rejected-row", user_id: "rejected-user", name: "Rejected Employee", status: "rejected" }),
  siteMember({ id: "invitation-row", user_id: null, name: "Unregistered Employee", status: "pending" }),
]
