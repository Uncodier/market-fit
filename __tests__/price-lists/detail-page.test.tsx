import { act, render, screen, waitFor } from "@testing-library/react"
import { Suspense, type ReactNode } from "react"
import PriceListDetail from "@/app/price-lists/[id]/page"
import { getPriceList } from "@/app/price-lists/actions"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "site-1" } }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}))

jest.mock("@/app/price-lists/actions", () => ({
  getPriceList: jest.fn(),
  listPriceListItems: jest.fn().mockResolvedValue({ data: [] }),
  setPriceListItem: jest.fn(),
  removePriceListItem: jest.fn(),
  upsertPriceList: jest.fn(),
}))

jest.mock("@/app/catalog/actions", () => ({
  listCatalogItems: jest.fn().mockResolvedValue({ data: [] }),
}))

jest.mock("@/app/commerce/resolve-relation", () => ({
  resolveRelationId: jest.fn(),
}))

jest.mock("@/app/price-lists/components/PriceListDialog", () => ({
  PriceListDialog: () => null,
}))

describe("PriceListDetail", () => {
  it("renders the active state from the loaded price list", async () => {
    jest.mocked(getPriceList).mockResolvedValue({
      data: {
        id: "price-list-1",
        site_id: "site-1",
        name: "Retail",
        is_active: true,
      },
    } as never)

    const params = Promise.resolve({ id: "price-list-1" })
    await act(async () => {
      render(
        <Suspense fallback={<div>Loading</div>}>
          <PriceListDetail params={params} />
        </Suspense>,
      )
    })

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Active" })).toBeChecked()
    })
  })
})
