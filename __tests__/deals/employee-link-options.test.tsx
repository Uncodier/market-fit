import { render, screen } from "@testing-library/react"
import { LinkTeamMemberDialog } from "@/app/deals/components/LinkTeamMemberDialog"
import type { Deal } from "@/app/deals/types"
import { employeeMembers, siteMember } from "@/__tests__/fixtures/site-members"

const mockSite = { id: "site-one" }

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/app/deals/actions", () => ({ addDealOwner: jest.fn(), getDealById: jest.fn() }))
jest.mock("@/app/components/ui/relation-select", () => ({
  RelationSelect: ({ options }: { options: { id: string; label: string }[] }) => (
    <select aria-label="Team member">{options.map(option => <option key={option.id}>{option.label}</option>)}</select>
  ),
}))

it("excludes disabled employees and already-linked active owners from deal options", async () => {
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: [
      ...employeeMembers,
      siteMember({ id: "linked-row", user_id: "linked-user", name: "Linked Employee" }),
    ] }),
  } as Response)
  render(<LinkTeamMemberDialog
    deal={{ id: "deal-one", owners: [{ user_id: "linked-user" }] } as Deal}
    isOpen
    onOpenChange={jest.fn()}
    onLinked={jest.fn()}
  />)
  await screen.findByRole("option", { name: "Active Employee" })
  expect(screen.getAllByRole("option")).toHaveLength(1)
})
