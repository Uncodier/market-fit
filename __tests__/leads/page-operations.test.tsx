import { act, renderHook } from "@testing-library/react"
import type { KeyedMutator } from "swr"
import { useLeadOperations } from "@/app/leads/hooks/use-lead-operations"
import { useLeadsBulkActions } from "@/app/leads/hooks/use-leads-bulk-actions"
import type { LeadsData } from "@/app/leads/hooks/use-leads-data"
import type { AttributionData, Lead } from "@/app/leads/types"
import { assignLeadToUser, deleteLead, importLeads, updateLead } from "@/app/leads/actions"
import { safeReload } from "@/app/utils/safe-reload"
import { toast } from "sonner"

jest.mock("@/app/leads/actions", () => ({
  assignLeadToUser: jest.fn(), deleteLead: jest.fn(), importLeads: jest.fn(), updateLead: jest.fn(),
}))
jest.mock("@/app/utils/safe-reload", () => ({ safeReload: jest.fn() }))
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }))

const site = { id: "site-one" }
const first = { id: "one", name: "One", email: "one@example.com", company_id: "linked", company: null, status: "new", origin: "website" } as Lead
const second = { ...first, id: "two", name: "Two" }
const attribution: AttributionData = { user_id: "user", user_name: "User", date: "2026-01-01", is_market_fit_influenced: false }

function cache() {
  let data: LeadsData = { leads: [first, second], totalCount: 20, isSearch: false }
  const mutate = jest.fn((updater: (current: LeadsData) => LeadsData) => {
    data = updater(data)
    return Promise.resolve(data)
  })
  return { mutate: mutate as unknown as KeyedMutator<LeadsData>, mockMutate: mutate, read: () => data }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(updateLead).mockResolvedValue({})
  jest.mocked(deleteLead).mockResolvedValue({})
  jest.mocked(assignLeadToUser).mockResolvedValue({ success: true })
  jest.spyOn(console, "error").mockImplementation(() => {})
  jest.spyOn(console, "warn").mockImplementation(() => {})
})
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

describe("extracted single lead operations", () => {
  it("keeps local merge/invalidation and deletion error handling without revalidation", async () => {
    const c = cache()
    const { result } = renderHook(() => useLeadOperations(site, c.read().leads, c.mutate))
    act(() => result.current.handleUpdateLead("one", { name: "Renamed" }))
    expect(c.read().leads[0].name).toBe("Renamed")
    act(() => result.current.handleUpdateLead("two", { invalidated: true }))
    expect(c.read().leads.map(l => l.id)).toEqual(["one"])
    expect(c.read().totalCount).toBe(20)
    jest.mocked(deleteLead).mockResolvedValueOnce({ error: "Denied" })
    await act(() => result.current.handleDeleteLead("one"))
    expect(c.read().leads).toHaveLength(1)
    expect(toast.error).toHaveBeenCalledWith("Denied")
    await act(() => result.current.handleDeleteLead("one"))
    expect(c.read().leads).toEqual([])
    expect(c.mockMutate).toHaveBeenLastCalledWith(expect.any(Function), { revalidate: false })
  })

  it("preserves status attribution, linked-company omission and local updates", async () => {
    const c = cache()
    const { result } = renderHook(() => useLeadOperations(site, c.read().leads, c.mutate))
    await act(() => result.current.handleUpdateLeadStatus("missing", "qualified"))
    expect(updateLead).not.toHaveBeenCalled()
    await act(() => result.current.handleUpdateLeadStatus("one", "converted"))
    expect(updateLead).not.toHaveBeenCalled()
    expect(result.current.pendingStatusChange).toEqual({ leadId: "one", leadName: "One", newStatus: "converted" })
    expect(result.current.showAttributionModal).toBe(true)
    await act(() => result.current.handleAttributionConfirm(attribution))
    expect(updateLead).toHaveBeenCalledWith(expect.objectContaining({ id: "one", status: "converted", site_id: site.id, attribution }))
    expect(jest.mocked(updateLead).mock.calls[0][0]).not.toHaveProperty("company")
    expect(c.read().leads[0]).toMatchObject({ status: "converted", attribution })
    expect(result.current.pendingStatusChange).toBeNull()
    expect(result.current.showAttributionModal).toBe(false)
    await act(() => result.current.handleUpdateLeadStatus("two", "lost"))
    act(() => result.current.handleAttributionCancel())
    expect(result.current.pendingStatusChange).toBeNull()
    expect(updateLead).toHaveBeenCalledTimes(1)
  })

  it("keeps existing attribution for direct updates and closes modal on resolved errors", async () => {
    const c = cache()
    const leads = [{ ...first, attribution }, second]
    const { result } = renderHook(() => useLeadOperations(site, leads, c.mutate))
    await act(() => result.current.handleUpdateLeadStatus("one", "contacted"))
    expect(updateLead).toHaveBeenCalledWith(expect.objectContaining({ status: "contacted", attribution }))
    jest.mocked(updateLead).mockResolvedValueOnce({ error: "Denied" })
    await act(() => result.current.handleUpdateLeadStatus("two", "lost"))
    await act(() => result.current.handleAttributionConfirm(attribution))
    expect(toast.error).toHaveBeenCalledWith("Denied")
    expect(c.read().leads[1].status).toBe("new")
    expect(result.current.showAttributionModal).toBe(false)
  })

  it("keeps no-site import guard and full/partial import reload timing", async () => {
    jest.useFakeTimers()
    const c = cache()
    const { result, rerender } = renderHook(({ currentSite }) => useLeadOperations(currentSite, [], c.mutate), { initialProps: { currentSite: null as typeof site | null } })
    let response: unknown
    await act(async () => { response = await result.current.handleImportLeads([first]) })
    expect(response).toEqual({ success: false, count: 0, errors: ["No site selected"] })
    expect(importLeads).not.toHaveBeenCalled()
    rerender({ currentSite: site })
    const partial = { success: true, count: 1, errors: ["row error"] }
    jest.mocked(importLeads).mockResolvedValueOnce(partial)
    await act(async () => { response = await result.current.handleImportLeads([first]) })
    expect(response).toBe(partial)
    expect(importLeads).toHaveBeenCalledWith([first], site.id)
    expect(safeReload).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(2999))
    expect(safeReload).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(1))
    expect(safeReload).toHaveBeenCalledWith(false, "Leads imported with some errors")
    jest.mocked(importLeads).mockResolvedValueOnce({ success: true, count: 1, errors: undefined })
    await act(() => result.current.handleImportLeads([first]))
    expect(safeReload).toHaveBeenLastCalledWith(false, "Leads imported successfully")
    jest.mocked(importLeads).mockRejectedValueOnce(new Error("offline"))
    await act(async () => { response = await result.current.handleImportLeads([first]) })
    expect(response).toEqual({ success: false, count: 0, errors: ["Failed to import leads"] })
  })

  it("keeps export URL, filename, blob cleanup and failure toast", async () => {
    const c = cache()
    const blob = new Blob(["csv"])
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:export") })
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: jest.fn() })
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    jest.mocked(fetch).mockResolvedValueOnce({ ok: true, blob: async () => blob } as Response)
    const { result } = renderHook(() => useLeadOperations(site, [], c.mutate))
    await act(() => result.current.handleExportLeads())
    expect(fetch).toHaveBeenCalledWith(`/api/leads/export?siteId=${site.id}`, { method: "GET", headers: { "Content-Type": "application/json" } })
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(anchor.download).toMatch(/^leads-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(anchor.isConnected).toBe(false)
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:export")
    jest.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    await act(() => result.current.handleExportLeads())
    expect(toast.error).toHaveBeenCalledWith("Failed to export leads")
  })
})

describe("extracted bulk operations", () => {
  it("preserves cancellation and resolved action-error delete semantics", async () => {
    const c = cache()
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(false)
    const { result } = renderHook(() => useLeadsBulkActions(site, { id: "user" }, c.read().leads, c.mutate))
    act(() => result.current.setSelectedLeads(new Set(["one"])))
    await act(() => result.current.handleBulkDelete())
    expect(deleteLead).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    jest.mocked(deleteLead).mockResolvedValueOnce({ error: "Denied" })
    await act(() => result.current.handleBulkDelete())
    expect(c.read().leads.map(l => l.id)).toEqual(["two"])
    expect(result.current.selectedLeads.size).toBe(0)
    expect(toast.success).toHaveBeenCalledWith("1 leads deleted successfully")
  })

  it("keeps authenticated assignment and status update selection clearing", async () => {
    const c = cache()
    const { result } = renderHook(() => useLeadsBulkActions(site, { id: "user" }, c.read().leads, c.mutate))
    act(() => result.current.setSelectedLeads(new Set(["one"])))
    await act(() => result.current.handleBulkAssign())
    expect(assignLeadToUser).toHaveBeenCalledWith("one", "user", site.id)
    expect(c.read().leads[0].assignee_id).toBe("user")
    expect(result.current.selectedLeads.size).toBe(0)
    act(() => result.current.setSelectedLeads(new Set(["two"])))
    await act(() => result.current.handleBulkStatusChange("converted"))
    expect(updateLead).toHaveBeenCalledWith(expect.objectContaining({ id: "two", status: "converted", site_id: site.id }))
    expect(jest.mocked(updateLead).mock.calls[0][0]).not.toHaveProperty("company")
    expect(c.read().leads[1].status).toBe("converted")
    expect(result.current.selectedLeads.size).toBe(0)
    expect(result.current.isBulkActionLoading).toBe(false)
  })

  it("keeps selections on thrown bulk failures and always clears loading", async () => {
    const c = cache()
    const { result } = renderHook(() => useLeadsBulkActions(site, { id: "user" }, c.read().leads, c.mutate))
    act(() => result.current.setSelectedLeads(new Set(["one"])))
    jest.mocked(updateLead).mockRejectedValueOnce(new Error("offline"))
    await act(() => result.current.handleBulkStatusChange("qualified"))
    expect(result.current.selectedLeads.size).toBe(1)
    expect(result.current.isBulkActionLoading).toBe(false)
    expect(toast.error).toHaveBeenCalledWith("Failed to update status for some leads")
  })
})