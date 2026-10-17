import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CalendarSection } from "@/app/components/settings/CalendarSection"
import { employeeMembers } from "@/__tests__/fixtures/site-members"

const mockSite = {
  id: "site-one",
  settings: { team_members: [{ email: "disabled@example.test", name: "Disabled Employee" }] },
}

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    currentSite: mockSite,
    updateSettings: jest.fn(),
  }),
}))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

const originalRandomUUID = Object.getOwnPropertyDescriptor(global.crypto, "randomUUID")

beforeAll(() => {
  Object.defineProperty(global.crypto, "randomUUID", {
    configurable: true,
    value: () => "11111111-1111-4111-8111-111111111111",
  })
})

afterAll(() => {
  if (originalRandomUUID) Object.defineProperty(global.crypto, "randomUUID", originalRandomUUID)
  else Reflect.deleteProperty(global.crypto, "randomUUID")
})

beforeEach(() => {
  jest.mocked(global.fetch).mockReset()
  jest.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, members: employeeMembers }),
  } as Response)
})

it("excludes disabled employees from shared-calendar member selection", async () => {
  render(<CalendarSection />)
  fireEvent.click(screen.getByRole("button", { name: /Add Calendar/ }))
  await screen.findByText("Active Employee")
  expect(screen.getAllByRole("checkbox")).toHaveLength(1)
  for (const member of employeeMembers.slice(1)) {
    expect(screen.queryByText(member.name!)).not.toBeInTheDocument()
  }
})

it("does not fall back to stale settings members when eligibility cannot be loaded", async () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)
  jest.mocked(global.fetch).mockResolvedValue({ ok: false, statusText: "Unavailable" } as Response)
  try {
    render(<CalendarSection />)
    fireEvent.click(screen.getByRole("button", { name: /Add Calendar/ }))
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByText("Disabled Employee")).not.toBeInTheDocument()
  } finally {
    consoleError.mockRestore()
  }
})
