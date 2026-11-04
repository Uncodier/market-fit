import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { CalendarSection } from "@/app/components/settings/CalendarSection"

const mockUpdateSettings = jest.fn()

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    currentSite: {
      id: "site-one",
      name: "Test Site",
      settings: {
        calendars: [{
          id: "calendar-one",
          name: "Team Meetings",
          slug: "team-meetings",
          member_ids: [],
          duration: 30,
          buffer: 15,
        }],
      },
    },
    updateSettings: mockUpdateSettings,
  }),
}))
jest.mock("@/app/services/site-members-service", () => ({
  siteMembersService: { getMembers: jest.fn().mockResolvedValue([]) },
}))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")
const originalExecCommand = Object.getOwnPropertyDescriptor(document, "execCommand")
const mockWriteText = jest.fn()
const mockExecCommand = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  mockWriteText.mockResolvedValue(undefined)
  mockExecCommand.mockReturnValue(false)
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mockWriteText },
  })
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: mockExecCommand,
  })
})

afterAll(() => {
  if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard)
  else Reflect.deleteProperty(navigator, "clipboard")
  if (originalExecCommand) Object.defineProperty(document, "execCommand", originalExecCommand)
  else Reflect.deleteProperty(document, "execCommand")
})

function renderInSettingsForm() {
  const onSubmit = jest.fn(event => event.preventDefault())
  render(<form onSubmit={onSubmit}><CalendarSection /></form>)
  return onSubmit
}

it("copies the booking URL without submitting settings or expanding the calendar", async () => {
  const onSubmit = renderInSettingsForm()
  const button = screen.getByRole("button", { name: "Copy calendar URL" })
  fireEvent.click(button)

  await waitFor(() => expect(toast.success).toHaveBeenCalledWith("URL copied to clipboard"))
  expect(mockWriteText).toHaveBeenCalledWith(`${window.location.origin}/book/test-site/rr/team-meetings`)
  expect(button).toHaveAttribute("type", "button")
  expect(onSubmit).not.toHaveBeenCalled()
  expect(mockUpdateSettings).not.toHaveBeenCalled()
  expect(screen.queryByLabelText("Calendar Name")).not.toBeInTheDocument()
})

it("waits for clipboard completion before confirming success", async () => {
  let finishCopy!: () => void
  mockWriteText.mockReturnValue(new Promise<void>(resolve => { finishCopy = resolve }))
  renderInSettingsForm()
  fireEvent.click(screen.getByRole("button", { name: "Copy calendar URL" }))

  expect(toast.success).not.toHaveBeenCalled()
  finishCopy()
  await waitFor(() => expect(toast.success).toHaveBeenCalled())
})

it("reports an error without submitting when clipboard access is unavailable", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined })
  const onSubmit = renderInSettingsForm()
  fireEvent.click(screen.getByRole("button", { name: "Copy calendar URL" }))

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to copy URL"))
  expect(mockExecCommand).toHaveBeenCalledWith("copy")
  expect(toast.success).not.toHaveBeenCalled()
  expect(onSubmit).not.toHaveBeenCalled()
})