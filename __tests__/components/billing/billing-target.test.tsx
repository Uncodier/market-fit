import { act, renderHook, waitFor } from "@testing-library/react"
import { useBillingTarget } from "@/app/billing/use-billing-target"

const selectSite = jest.fn()
const target = { id: "target" }
let requestedId: string | null = "target"
let currentSite = { id: "other" }
let sites = [target]
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ sites, currentSite, setCurrentSite: selectSite, isLoading: false }) }))
jest.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => requestedId }) }))

beforeEach(() => { selectSite.mockReset(); requestedId = "target"; currentSite = { id: "other" }; sites = [target] })

it("blocks rendering checkout for the previous site until the authorized target is selected", async () => {
  const { result, rerender } = renderHook(() => useBillingTarget())
  expect(result.current.pending).toBe(true)
  await waitFor(() => expect(selectSite).toHaveBeenCalledWith(target))
  act(() => { currentSite = target; rerender() })
  expect(result.current.pending).toBe(false)
})

it("never selects an inaccessible supplied site", () => {
  requestedId = "foreign"
  const { result } = renderHook(() => useBillingTarget())
  expect(result.current.error).toMatch(/not available/)
  expect(selectSite).not.toHaveBeenCalled()
})

it("leaves ordinary billing navigation unchanged", () => {
  requestedId = null
  const { result } = renderHook(() => useBillingTarget())
  expect(result.current.pending).toBe(false)
  expect(selectSite).not.toHaveBeenCalled()
})

it("reports selection failure instead of displaying the wrong checkout", async () => {
  selectSite.mockRejectedValue(new Error("Unavailable"))
  const { result } = renderHook(() => useBillingTarget())
  await waitFor(() => expect(result.current.error).toMatch(/could not be selected/))
})