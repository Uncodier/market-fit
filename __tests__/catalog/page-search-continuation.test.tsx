import { fireEvent, render, screen, waitFor, act } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useSearchParams } from "next/navigation"
import CatalogPage from "@/app/catalog/page"
import { listCatalogItems } from "@/app/catalog/actions"
import { marketplaceItem } from "../marketplace/catalog-fixture"
import type { ReactNode } from "react"

jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/catalog/list-categories", () => ({ listCatalogPageCategories: async () => ({ data: [], complete: false }) }))
jest.mock("@/app/catalog/reorder-actions", () => ({ reorderCatalogDisplay: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useMobileView: () => ["table", jest.fn()], useIsMobile: () => false }))
jest.mock("@/app/catalog/components/CreateCatalogItemDialog", () => ({ CreateCatalogItemDialog: () => null }))
jest.mock("@/app/catalog/components/KanbanView", () => ({ KanbanView: () => null }))
jest.mock("@/app/catalog/components/CatalogTable", () => ({ CatalogTable: ({ items }: { items: Array<{ id: string }> }) =>
  <div data-testid="ranks">{items.map(item => item.id).join(",")}</div> }))
jest.mock("next/dynamic", () => ({ __esModule: true, default: () => () => null }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

const oldId = "11111111-1111-4111-8111-111111111111"
const newId = "22222222-2222-4222-8222-222222222222"
const ranks = Array.from({ length: 60 }, (_, index) => marketplaceItem(`Rank-${index + 1}`))

beforeEach(() => {
  window.history.replaceState(null, "", "/catalog?q=shoes")
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("q=shoes") as ReturnType<typeof useSearchParams>)
  jest.mocked(listCatalogItems).mockReset().mockImplementation(async params => ({
    data: ranks.slice(((params.page || 1) - 1) * 50, (params.page || 1) * 50), count: 60,
    count_kind: "candidate_window", search_id: oldId, mode: "text", degraded: true,
  }))
})

it("actual Catalog page requests old snapshot on page 2, then expiry restarts page 1 rather than reusing/duplicating ranks", async () => {
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, errorRetryCount: 0 }}><CatalogPage /></SWRConfig>)
  await waitFor(() => expect(screen.getByTestId("ranks")).toHaveTextContent("Rank-50"))
  fireEvent.click(screen.getByRole("button", { name: "2" }))
  await waitFor(() => expect(screen.getByTestId("ranks")).toHaveTextContent("Rank-60"))
  expect(listCatalogItems).toHaveBeenCalledWith(expect.objectContaining({ page: 2, search_id: oldId }))
  expect(screen.getByTestId("ranks").textContent).toBe(ranks.slice(50).map(item => item.id).join(","))
  expect(new URLSearchParams(window.location.search).get("search_id")).toBe(oldId)
  fireEvent.click(screen.getByRole("button", { name: "1" }))
  await waitFor(() => expect(screen.getByTestId("ranks")).toHaveTextContent("Rank-50"))
  jest.mocked(listCatalogItems).mockResolvedValueOnce({ data: [], count: 0, error: "Expired", error_status: 409 })
    .mockImplementation(async params => ({ data: ranks.slice(0, 50), count: 60,
      count_kind: "candidate_window", search_id: params.search_id || newId, mode: "hybrid", degraded: false }))
  fireEvent.click(screen.getByRole("button", { name: "2" }))
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalledWith(expect.objectContaining({ page: 1, generation: 1 })))
  await act(async () => {})
  await waitFor(() => expect(screen.getByTestId("ranks").textContent).toBe(ranks.slice(0, 50).map(item => item.id).join(",")))
  expect(new URLSearchParams(window.location.search).get("search_id")).toBe(newId)
  expect(new URLSearchParams(window.location.search).has("page")).toBe(false)
})