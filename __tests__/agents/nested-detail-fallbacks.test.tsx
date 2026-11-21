import { render, screen } from "@testing-library/react"
import { notFound, useSearchParams } from "next/navigation"
import CommandDetail from "@/app/agents/[id]/[commandId]/command-detail"
import CommandLoading from "@/app/agents/[id]/[commandId]/loading"
import CommandPage from "@/app/agents/[id]/[commandId]/page"
import ToolDetail from "@/app/agents/tools/[logId]/tool-detail"
import ToolLoading from "@/app/agents/tools/[logId]/loading"
import ToolPage from "@/app/agents/tools/[logId]/page"

const mockFrom = jest.fn()
jest.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: mockFrom }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => { throw new Error("Not found boundary") }),
  useSearchParams: jest.fn(),
}))
jest.mock("@/app/agents/[id]/[commandId]/command-detail", () => () => null)
jest.mock("@/app/agents/tools/[logId]/tool-detail", () => () => null)

// Exercise the real detail actions, including their mapping of a missing row to an error response.
function queueRead(data: unknown, error: { code: string; message: string } | null = null) {
  const eq = jest.fn(() => ({ single: async () => ({ data, error }) }))
  mockFrom.mockReturnValueOnce({ select: () => ({ eq }) })
  return eq
}

const commandPage = () => CommandPage({ params: Promise.resolve({ id: "url-agent", commandId: "cmd-1" }) })
const toolPage = () => ToolPage({ params: Promise.resolve({ logId: "log-1" }) })

beforeEach(() => { jest.clearAllMocks(); mockFrom.mockReset() })
afterEach(() => { jest.restoreAllMocks() })

describe.each([
  { shape: "command-detail", Loading: CommandLoading, page: commandPage, table: "commands", item: "command" },
  { shape: "tool-log-detail", Loading: ToolLoading, page: toolPage, table: "instance_logs", item: "tool log" },
])("$item route", ({ shape, Loading, page, table, item }) => {
  it("has its own decorative fallback without focusable controls or URL hooks", () => {
    render(<Loading />)
    const region = screen.getByRole("status", { name: "common.loading", busy: true })
    expect(region.querySelector(`[aria-hidden="true"] [data-skeleton-shape="${shape}"]`)).toBeInTheDocument()
    expect(region.querySelector("button, a[href], input, select, textarea, [tabindex]")).toBeNull()
    expect(useSearchParams).not.toHaveBeenCalled()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it("routes an absent or inaccessible row to not-found, not loading", async () => {
    queueRead(null, { code: "PGRST116", message: "No matching row" })
    await expect(page()).rejects.toThrow("Not found boundary")
    expect(notFound).toHaveBeenCalledTimes(1)
    expect(mockFrom.mock.calls).toEqual([[table]])
  })

  it("shows a failed lookup instead of not-found or an indefinite skeleton", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    queueRead(null, { code: "57014", message: "Internal database diagnostic" })
    render(await page())
    expect(screen.getByRole("alert")).toHaveTextContent(`Unable to load this ${item}.`)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(notFound).not.toHaveBeenCalled()
    expect(mockFrom.mock.calls).toEqual([[table]])
  })
})

it("passes a loaded command to the detail view even when the command itself is pending", async () => {
  const command = { id: "cmd-1", task: "Review", status: "pending" as const, agent_id: "record-agent" }
  queueRead(command)
  const matchAgent = queueRead({ name: "Support" })
  expect(await commandPage()).toEqual(<CommandDetail command={command} commandId="cmd-1" agentName="Support" />)
  expect(matchAgent).toHaveBeenCalledWith("id", "record-agent")
})

it("passes a loaded log to the detail view even when the log records an error", async () => {
  const log = { id: "log-1", log_type: "tool_result", level: "error", message: "Tool failed", created_at: "2026-01-01" } as const
  queueRead(log)
  expect(await toolPage()).toEqual(<ToolDetail log={log} logId="log-1" />)
})