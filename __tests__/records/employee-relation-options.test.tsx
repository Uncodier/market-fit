import { act, renderHook, waitFor } from "@testing-library/react"
import { useRelationOptions } from "@/app/records/hooks/useRelationOptions"
import { employeeMembers } from "@/__tests__/fixtures/site-members"

const fields = [{ type: "relation", relationTarget: "team_member" }]
const selectedIds = ["disabled-user"]

beforeEach(() => {
  jest.mocked(global.fetch).mockReset()
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: employeeMembers }),
  } as Response)
})

it("excludes disabled employees even when they are a retained record relation", async () => {
  const { result } = renderHook(() => useRelationOptions(fields, "site-one", selectedIds))
  await waitFor(() => expect(result.current.relationOptions.team_member).toEqual([
    { id: "active-user", label: "Active Employee", searchText: "Active Employee active@example.test" },
  ]))
  expect(global.fetch).toHaveBeenCalledWith("/api/site-members/site-one")
})

it("does not restore an inactive employee when searching by their name", async () => {
  const { result } = renderHook(() => useRelationOptions(fields, "site-one", selectedIds))
  await waitFor(() => expect(result.current.relationOptions.team_member).toHaveLength(1))
  act(() => result.current.handleSearchChange("team_member", "Disabled"))
  await waitFor(() => expect(result.current.relationOptions.team_member).toEqual([]))
  act(() => result.current.handleSearchChange("team_member", "active@example.test"))
  await waitFor(() => expect(result.current.relationOptions.team_member).toHaveLength(1))
})
