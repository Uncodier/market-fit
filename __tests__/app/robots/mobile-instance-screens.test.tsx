import { fireEvent, render, screen } from "@testing-library/react"
import RobotsPage from "@/app/robots/page"

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockMobile = true
let mockQuery = "instance=one"
const mockInstances = [
  { id: "one", name: "Research", status: "running" },
  { id: "two", name: "Support", status: "stopped" },
]

jest.mock("@/app/robots/use-robots-controller", () => ({
  useRobotsController: () => ({
    isMobile: mockMobile, searchParams: new URLSearchParams(mockQuery),
    selectedInstanceId: new URLSearchParams(mockQuery).get("instance") || "one",
    activeRobotInstance: mockInstances[0], router: { replace: mockReplace, push: mockPush },
    setLocalSelectedInstanceId: jest.fn(), getInstanceById: (id: string) => mockInstances.find(instance => instance.id === id),
    currentSite: { id: "site-a" }, tabInstances: mockInstances, instanceAvatars: {},
    t: (key: string) => key === "robots.browser.search" ? "Search instances..." : key,
    workspaceTabs: [{ value: "agent", label: "Agent" }, { value: "files", label: "Files" }],
    activeWorkspaceTab: "agent", handleWorkspaceTabChange: jest.fn(), isCanvasMode: false,
  }),
}))
jest.mock("@/app/robots/use-instance-creation", () => ({ useInstanceCreation: (input: unknown) => input }))
jest.mock("@/app/robots/use-instance-actions", () => ({ useInstanceActions: (input: unknown) => input }))
jest.mock("@/app/robots/use-browser-workspace", () => ({ useBrowserWorkspace: (input: unknown) => input }))
jest.mock("@/app/robots/use-browser-presentation", () => ({ useBrowserPresentation: (input: unknown) => input }))
jest.mock("@/app/robots/use-workspace-tabs", () => ({ useWorkspaceTabs: (input: unknown) => input }))
jest.mock("@/app/robots/instance-header", () => ({ InstanceHeader: () => <div>Desktop instances</div> }))
jest.mock("@/app/robots/instance-modals", () => ({ InstanceModals: () => null }))
jest.mock("@/app/robots/robots-workspace", () => ({ RobotsWorkspace: () => <input aria-label="Agent draft" /> }))
jest.mock("@/app/context/RobotsContext", () => ({ useRobots: () => ({ error: null }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/components/ui/responsive-tabs-list", () => ({
  ResponsiveTabsList: () => <div aria-label="Workspace sections">Agent · Files</div>,
}))
jest.mock("@/lib/navigation/stale-router", () => ({
  navigateOrAssign: (router: { push: (href: string) => void }, href: string) => router.push(href),
}))

beforeEach(() => { mockMobile = true; mockQuery = "instance=one"; jest.clearAllMocks() })

test("uses a full list screen, preserves the mounted draft and brings the selector into the sticky header", () => {
  const view = render(<RobotsPage />)
  expect(screen.queryByText("Desktop instances")).not.toBeInTheDocument()
  expect(screen.getByLabelText("Workspace sections").closest("header")).toBeInTheDocument()
  const draft = screen.getByLabelText("Agent draft")
  fireEvent.change(draft, { target: { value: "Unsent draft" } })
  fireEvent.click(screen.getByRole("button", { name: "Back to instances" }))
  expect(mockPush).toHaveBeenCalledWith("/robots?view=instances")
  mockQuery = "view=instances"
  view.rerender(<RobotsPage />)
  expect(screen.getByRole("region", { name: "Instances" })).toBeInTheDocument()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Back to instances" })).not.toBeInTheDocument()
  expect(draft).not.toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: /Support/ }))
  expect(mockPush).toHaveBeenLastCalledWith("/robots?instance=two&name=Support")
  mockQuery = "instance=one"
  view.rerender(<RobotsPage />)
  expect(screen.getByLabelText("Agent draft")).toBe(draft)
  expect(draft).toHaveValue("Unsent draft")
  expect(draft).toBeVisible()
})

test("desktop retains its instance header even when navigating through a list URL", () => {
  mockMobile = false
  mockQuery = "view=instances"
  render(<RobotsPage />)
  expect(screen.getByText("Desktop instances")).toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Instances" })).not.toBeInTheDocument()
})

test("mobile reserves the topbar inset and lays out the workspace below the in-flow toolbar", () => {
  render(<RobotsPage />)
  const toolbar = screen.getByLabelText("Workspace sections").closest("header")!
  const detail = screen.getByLabelText("Agent draft").parentElement!

  expect(toolbar.parentElement).toHaveClass("pt-[var(--topbar-height,64px)]", "min-h-0")
  expect(toolbar.nextElementSibling).toBe(detail)
  expect(detail).toHaveClass("relative", "flex-1", "min-h-0")
  expect(detail).not.toHaveClass("absolute", "inset-0")
})

test("desktop keeps the full-height absolute workspace without a second topbar inset", () => {
  mockMobile = false
  render(<RobotsPage />)
  const detail = screen.getByLabelText("Agent draft").parentElement!

  expect(detail).toHaveClass("absolute", "inset-0")
  expect(detail.parentElement).not.toHaveClass("pt-[var(--topbar-height,64px)]")
})

test("centers workspace tabs vertically using a full-height flex row rather than an inline baseline", () => {
  render(<RobotsPage />)
  const tabsRoot = screen.getByLabelText("Workspace sections").parentElement!

  expect(tabsRoot).toHaveClass("flex", "h-full", "items-center")
  expect(tabsRoot.parentElement).toHaveClass("flex", "h-full", "items-center")
})