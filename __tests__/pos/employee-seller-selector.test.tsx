import { fireEvent, render, screen } from "@testing-library/react"
import { PosSellerSelector } from "@/app/pos/components/PosSellerSelector"
import { employeeMembers } from "@/__tests__/fixtures/site-members"

beforeEach(() => {
  jest.mocked(global.fetch).mockReset()
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: employeeMembers }),
  } as Response)
})

it("shows enabled sellers only and keeps the selection callback", async () => {
  const onValueChange = jest.fn()
  const onSellerChange = jest.fn()
  render(<PosSellerSelector
    siteId="site-one"
    value="active-user"
    onValueChange={onValueChange}
    onSellerChange={onSellerChange}
  />)
  const trigger = await screen.findByRole("button", { name: "Seller: Active Employee" })
  fireEvent.keyDown(trigger, { key: "Enter" })
  const active = await screen.findByRole("menuitemradio", { name: /Active Employee/ })
  for (const member of employeeMembers.slice(1)) {
    expect(screen.queryByRole("menuitemradio", { name: member.name! })).not.toBeInTheDocument()
  }
  fireEvent.click(active)
  expect(onValueChange).toHaveBeenCalledWith("active-user")
  expect(onSellerChange).toHaveBeenCalledWith({ userId: "active-user", name: "Active Employee" })
})
