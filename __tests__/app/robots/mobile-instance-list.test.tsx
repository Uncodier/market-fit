import { fireEvent, render, screen } from "@testing-library/react"
import { MobileInstanceList } from "@/app/robots/mobile-instance-list"
import { localeMessages } from "@/app/context/locale-catalog"

let mockError: string | null = null
jest.mock("@/app/context/RobotsContext", () => ({ useRobots: () => ({ error: mockError }) }))
const select = jest.fn()
const refresh = jest.fn()
const props = {
  tabInstances: [
    { id: "one", name: "Research", status: "running" },
    { id: "two", name: "Support", status: "stopped" },
  ], instanceAvatars: {}, isLoadingRobots: false,
  t: (key: string) => localeMessages.en[key] ?? key,
  handleCreateNewInstance: jest.fn(), refreshRobots: refresh,
  currentSite: { id: "site-a" }, onSelect: select,
} as unknown as React.ComponentProps<typeof MobileInstanceList>
beforeEach(() => { mockError = null; jest.clearAllMocks() })

test("renders a searchable screen, not a modal, and opens the selected instance", () => {
  render(<MobileInstanceList {...props} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search instances..."), { target: { value: "Support" } })
  expect(screen.queryByText("Research")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /Support/ }))
  expect(select).toHaveBeenCalledWith("two")
})

test("distinguishes loading, empty results and errors", () => {
  const view = render(<MobileInstanceList {...props} tabInstances={[]} isLoadingRobots />)
  expect(screen.getByRole("status", { name: "Loading instances" })).toBeInTheDocument()
  view.rerender(<MobileInstanceList {...props} tabInstances={[]} />)
  expect(screen.getByText("No instances found")).toBeInTheDocument()
  mockError = "Read failed"
  view.rerender(<MobileInstanceList {...props} tabInstances={[]} />)
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load instances")
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(refresh).toHaveBeenCalledWith("site-a")
})