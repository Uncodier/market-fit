import { render, waitFor } from "@testing-library/react"
import useSWR from "swr"
import { InventoryLevelsTab } from "@/app/inventory/components/InventoryLevelsTab"
import { listInventoryLevels } from "@/app/inventory/actions"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("@/app/inventory/actions", () => ({
  listInventoryLevels: jest.fn(),
  setInventoryLevel: jest.fn(),
}))

jest.mock("@/lib/printer/hooks/use-printer", () => ({
  usePrinter: () => ({ printJob: jest.fn() }),
}), { virtual: true })

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: null }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

describe("InventoryLevelsTab", () => {
  it("passes the selected sort order to the inventory query", async () => {
    const listInventoryLevelsMock = jest.mocked(listInventoryLevels)
    listInventoryLevelsMock.mockResolvedValue({ data: [], count: 0 })

    jest.mocked(useSWR).mockImplementation((key, fetcher) => {
      if (key && fetcher) {
        void fetcher()
      }

      return {
        data: { data: [], count: 0 },
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      } as ReturnType<typeof useSWR>
    })

    render(
      <InventoryLevelsTab
        siteId="site-1"
        locations={[]}
        page={1}
        setPage={jest.fn()}
        pageSize={50}
        q=""
        selectedLocation="all"
        sort="oldest"
      />,
    )

    await waitFor(() => {
      expect(listInventoryLevelsMock).toHaveBeenCalledWith({
        siteId: "site-1",
        page: 1,
        pageSize: 50,
        q: "",
        locationId: undefined,
        sort: "oldest",
      })
    })
  })
})
