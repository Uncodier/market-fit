import { renderHook, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import type { PropsWithChildren } from "react"
import { useOrderLineOperations } from "@/app/order-lines/use-order-line-operations"
import { employeeMembers } from "@/__tests__/fixtures/site-members"

jest.mock("@/app/order-lines/actions", () => ({
  advanceOperationalOrderLines: jest.fn(),
  assignOperationalOrderLines: jest.fn(),
  updateOperationalOrderLineStatus: jest.fn(),
}))

function Wrapper({ children }: PropsWithChildren) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
}

beforeEach(() => {
  jest.mocked(global.fetch).mockReset()
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: employeeMembers }),
  } as Response)
})

it("uses only enabled assignees and does not reinsert a disabled current user", async () => {
  const { result } = renderHook(() => useOrderLineOperations({
    siteId: "site-one",
    user: { id: "disabled-user", user_metadata: { name: "Disabled Employee" } },
    refresh: async () => undefined,
    t: key => key,
  }), { wrapper: Wrapper })
  await waitFor(() => expect(result.current.assignees).toEqual([
    { id: "active-user", name: "Active Employee" },
  ]))
})

it("shows no unverified current-user option before the member list loads", () => {
  const { result } = renderHook(() => useOrderLineOperations({
    user: { id: "disabled-user" },
    refresh: async () => undefined,
    t: key => key,
  }), { wrapper: Wrapper })
  expect(result.current.assignees).toEqual([])
  expect(global.fetch).not.toHaveBeenCalled()
})
