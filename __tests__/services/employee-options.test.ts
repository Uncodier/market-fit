import { siteMembersService } from "@/app/services/site-members-service"
import { listSiteCouriers } from "@/app/shipments/site-couriers"
import { employeeMembers, siteMember } from "@/__tests__/fixtures/site-members"

beforeEach(() => {
  jest.mocked(global.fetch).mockReset()
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: employeeMembers }),
  } as Response)
})

it("filters shared task and courier options without hiding employees from team management", async () => {
  await expect(siteMembersService.getMembers("site-one")).resolves.toEqual(employeeMembers)
  await expect(siteMembersService.getAssigneeOptions("site-one"))
    .resolves.toEqual([{ id: "active-user", name: "Active Employee" }])
  await expect(listSiteCouriers("site-one"))
    .resolves.toEqual([{ id: "active-user", name: "Active Employee" }])
})

it("preserves existing name and email fallbacks", async () => {
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: [siteMember({ name: "  " })] }),
  } as Response)
  await expect(siteMembersService.getAssigneeOptions("site-one"))
    .resolves.toEqual([{ id: "active-user", name: "active@example.test" }])
})
