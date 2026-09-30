import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { SegmentDonut } from "@/app/components/dashboard/segment-donut"
import { useAuth } from "@/app/hooks/use-auth"
import { useSite } from "@/app/context/SiteContext"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))

const fetchMock = global.fetch as jest.Mock
const props = { endpoint: "clients-by-segment", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29) }
const response = (body: unknown) => ({ ok: true, json: async () => body })
const rows = [{ name: "Enterprise audience with a complete label", value: "3" }, { name: "Other", value: 1 }]

function mount(initial = {}) {
  const cache = new Map()
  const view = (next = {}) => <SWRConfig value={{ provider: () => cache }}><SegmentDonut {...props} {...initial} {...next} /></SWRConfig>
  return { ...render(view()), view }
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response({ segments: rows }))
  ;(useAuth as jest.Mock).mockReturnValue({ user: { id: "user-a" }, isLoading: false })
  ;(useSite as jest.Mock).mockReturnValue({ currentSite: { id: "site-a" } })
})

it("renders accessible full labels, totals and shares without refetching on callback changes", async () => {
  const first = jest.fn()
  const { rerender, view } = mount({ onTotalUpdate: first })
  const table = await screen.findByRole("table", { name: /clients by segment: share of displayed results/i })
  expect(within(table).getByRole("row", { name: /Enterprise audience with a complete label 3 75.0%/ })).toBeInTheDocument()
  expect(within(table).getByRole("row", { name: /Displayed total 4 100.0%/ })).toBeInTheDocument()
  await waitFor(() => expect(first).toHaveBeenLastCalledWith("4"))
  const second = jest.fn()
  rerender(view({ onTotalUpdate: second, startDate: new Date(props.startDate), endDate: new Date(props.endDate) }))
  await waitFor(() => expect(second).toHaveBeenLastCalledWith("4"))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it("does not let an old response overwrite changed filters", async () => {
  let resolveOld!: (value: unknown) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
  const { rerender, view } = mount()
  rerender(view({ segmentId: "new-segment" }))
  await screen.findByText("Other")
  await act(async () => resolveOld(response({ segments: [{ name: "Stale", value: 900 }] })))
  expect(screen.queryByText("Stale")).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("clears prior totals and rows during a new request", async () => {
  const onTotalUpdate = jest.fn()
  const { rerender, view } = mount({ onTotalUpdate })
  await screen.findByText("Other")
  fetchMock.mockImplementation(() => new Promise(() => {}))
  rerender(view({ endpoint: "clients-by-campaign" }))
  expect(screen.queryByText("Other")).not.toBeInTheDocument()
  expect(onTotalUpdate).toHaveBeenLastCalledWith("—")
})

it.each([
  { ok: false, status: 500 },
  response({ segments: [{ name: "Invalid", value: "not-a-number" }] }),
  response({ unexpected: [] }),
])("distinguishes failures from empty data and retries", async failed => {
  fetchMock.mockResolvedValueOnce(failed)
  const onTotalUpdate = jest.fn()
  mount({ onTotalUpdate })
  expect(await screen.findByRole("alert")).toBeInTheDocument()
  expect(screen.queryByText("No data for the selected filters.")).not.toBeInTheDocument()
  expect(onTotalUpdate).not.toHaveBeenCalledWith("0")
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await screen.findByText("Other")
})

it("shows a successful empty result as zero", async () => {
  fetchMock.mockResolvedValue(response({ campaigns: [] }))
  const onTotalUpdate = jest.fn()
  mount({ onTotalUpdate })
  expect(await screen.findByText("No data for the selected filters.")).toBeInTheDocument()
  expect(onTotalUpdate).toHaveBeenLastCalledWith("0")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("does not invent a currency and honors currency metadata", async () => {
  const { rerender, view } = mount({ formatValues: true })
  await screen.findByRole("table")
  expect(screen.getByText("Reported amounts; currency not provided.")).toBeInTheDocument()
  expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  fetchMock.mockResolvedValue(response({ campaigns: rows, currency: "EUR" }))
  rerender(view({ endpoint: "revenue-by-campaign" }))
  expect(await screen.findByText("€4.00")).toBeInTheDocument()
  expect(screen.queryByText(/currency not provided/)).not.toBeInTheDocument()
})