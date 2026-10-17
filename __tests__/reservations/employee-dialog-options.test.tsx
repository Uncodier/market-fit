import { fireEvent, render, screen } from "@testing-library/react"
import { CreateReservationDialog } from "@/app/reservations/components/CreateReservationDialog"
import { CreateCalendarBlockDialog } from "@/app/reservations/components/CreateCalendarBlockDialog"
import { employeeMembers } from "@/__tests__/fixtures/site-members"
import type { PropsWithChildren } from "react"

const mockSite = { id: "site-one", settings: {} }
const mockMembers = { members: employeeMembers }
const mockCatalog = { data: [] }
const mockTranslate = () => ""

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: mockTranslate }) }))
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string[] | null) => ({
    data: key?.[0] === "site_members" ? mockMembers : key?.[0] === "catalog" ? mockCatalog : undefined,
    isLoading: false,
  }),
}))
jest.mock("@/app/leads/actions", () => ({ getLeads: jest.fn() }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/catalog/modifier-actions", () => ({ getModifierGroupsForCatalogItem: jest.fn() }))
jest.mock("@/app/reservations/calendar-blocks-actions", () => ({ upsertCalendarBlock: jest.fn(), deleteCalendarBlock: jest.fn() }))
jest.mock("@/app/reservations/components/reservation-dialog-submit", () => ({
  submitServiceReservationForm: jest.fn(), submitTeamTaskReservation: jest.fn(), cancelReservationFromDialog: jest.fn(),
}))
jest.mock("@/app/components/ui/relation-select", () => ({
  RelationSelect: ({ options }: { options: { id: string; label: string }[] }) => (
    <select aria-label="Staff member">{options.map(option => <option key={option.id}>{option.label}</option>)}</select>
  ),
}))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: PropsWithChildren<{ value: string; onValueChange: (value: string) => void }>) => (
    <select aria-label="Block type" value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: PropsWithChildren) => <>{children}</>,
  SelectItem: ({ children, value }: PropsWithChildren<{ value: string }>) => <option value={value}>{children}</option>,
}))
jest.mock("@/app/components/ui/date-picker", () => ({ DatePicker: () => null }))
jest.mock("@/app/components/ui/time-select", () => ({ TimeSelect: () => null }))
jest.mock("@/app/reservations/components/reservation-dialog-service-fields", () => ({
  ReservationDialogFormSkeleton: () => null,
  ReservationServiceFields: () => null,
}))
jest.mock("@/app/reservations/components/reservation-dialog-task-fields", () => ({
  ReservationNoServicesState: () => null,
  ReservationTaskFields: ({ members }: { members: { user_id: string; name: string | null }[] }) => (
    <select aria-label="Task assignee">{members.map(member => <option key={member.user_id}>{member.name}</option>)}</select>
  ),
}))

it("passes only enabled employees to the reservation task selector", async () => {
  render(<CreateReservationDialog open onOpenChange={jest.fn()} onSuccess={jest.fn()} />)
  await screen.findByRole("option", { name: "Active Employee" })
  expect(screen.getAllByRole("option")).toHaveLength(1)
})

it("excludes disabled employees from calendar-block staff selection", () => {
  render(<CreateCalendarBlockDialog open onOpenChange={jest.fn()} />)
  fireEvent.change(screen.getByRole("combobox", { name: "Block type" }), { target: { value: "user" } })
  expect(screen.getByRole("option", { name: "Active Employee" })).toBeInTheDocument()
  for (const member of employeeMembers.slice(1)) {
    expect(screen.queryByRole("option", { name: member.name! })).not.toBeInTheDocument()
  }
})
