import { act, render, screen, waitFor } from "@testing-library/react"
import { SalesView } from "@/app/leads/components/SalesView"
import { getSales } from "@/app/sales/actions"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/sales/actions", () => ({ getSales: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

function recorded(siteId: string, leadId: string) {
  act(() => window.dispatchEvent(new CustomEvent("lead:invoice-payment-recorded", { detail: { siteId, leadId } })))
}

it("refreshes SalesView only for the current site and lead and removes the listener", async () => {
  jest.mocked(getSales).mockResolvedValue({ sales: [] })
  const { unmount } = render(<SalesView leadId="lead-a" />)
  await screen.findByText("No sales found")
  expect(getSales).toHaveBeenCalledTimes(1)
  recorded("site-b", "lead-a")
  recorded("site-a", "lead-b")
  expect(getSales).toHaveBeenCalledTimes(1)
  recorded("site-a", "lead-a")
  await waitFor(() => expect(getSales).toHaveBeenCalledTimes(2))
  await screen.findByText("No sales found")
  unmount()
  recorded("site-a", "lead-a")
  expect(getSales).toHaveBeenCalledTimes(2)
})