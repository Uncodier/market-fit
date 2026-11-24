import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { useSearchParams } from "next/navigation"
import { SWRConfig } from "swr"
import VisitsPage from "@/app/visits/page"
import { VisitRegistrationForm } from "@/app/visits/components/VisitRegistrationForm"
import { useSite } from "@/app/context/SiteContext"
import { listCatalogItems } from "@/app/catalog/actions"
import { listLocations } from "@/app/inventory/actions"
import { listReservationSchedules } from "@/app/reservations/schedule-actions"
import { getVisitsSettings, listVisitEmployees, registerBuyerVisit, registerVisit } from "@/app/visits/actions"
import { getReservationForVisit, attestReservation } from "@/app/visits/attest-actions"
import { mergeVisitsSettings } from "@/app/visits/visit-helpers"
import type { CatalogItem, Location } from "@/app/types"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({
  t: (key: string, params?: { count: number }) => params?.count ? `${params.count} min` : key,
}) }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn() }))
jest.mock("@/app/reservations/schedule-actions", () => ({ listReservationSchedules: jest.fn() }))
jest.mock("@/app/visits/actions", () => ({
  getVisitsSettings: jest.fn(), listVisitEmployees: jest.fn(), registerVisit: jest.fn(), registerBuyerVisit: jest.fn(),
}))
jest.mock("@/app/visits/attest-actions", () => ({ getReservationForVisit: jest.fn(), attestReservation: jest.fn() }))

const settings = mergeVisitsSettings({ require_signature: false, require_photo: false, terms_text: "Site terms" })
const config = { provider: () => new Map(), revalidateOnFocus: false }
function Cache({ children }: PropsWithChildren) {
  return <SWRConfig value={config}>{children}</SWRConfig>
}
function selectSite(id: string, isLoading = false) {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id, name: id }, isLoading } as ReturnType<typeof useSite>)
}
function noResourceReads() {
  for (const read of [listCatalogItems, listLocations, listVisitEmployees, listReservationSchedules]) {
    expect(read).not.toHaveBeenCalled()
  }
}
function identityField(field: string) {
  return screen.getByRole("textbox", { name: `visits.fields.${field}` })
}
function identityNext() {
  const card = screen.getByRole("heading", { name: "visits.steps.identity.title" }).closest<HTMLElement>(".visit-slide-card")!
  return within(card).getByRole("button", { name: "visits.actions.continue" })
}
function catalog(siteId: string) {
  return { count: 1, data: [{ id: `service-${siteId}`, name: `Service ${siteId}` } as CatalogItem] }
}

beforeEach(() => {
  jest.clearAllMocks()
  selectSite("A")
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  jest.mocked(getVisitsSettings).mockResolvedValue({ data: settings })
  jest.mocked(listCatalogItems).mockImplementation(async ({ siteId }) => catalog(siteId))
  jest.mocked(listLocations).mockResolvedValue({ data: [{ id: "lobby", name: "Lobby" } as Location] })
  jest.mocked(listVisitEmployees).mockResolvedValue({ data: [{ id: "employee", name: "Employee" }] })
  jest.mocked(listReservationSchedules).mockResolvedValue({ data: [{ catalog_item_id: "service-A", duration_minutes: 45 }] })
  jest.mocked(registerVisit).mockResolvedValue({ error: "Visit not accepted" })
})

it("waits for workspace settings and valid identity, then loads picker data without replacing the inputs", async () => {
  selectSite("A", true)
  let finishCatalog!: (value: ReturnType<typeof catalog>) => void
  jest.mocked(listCatalogItems).mockReturnValueOnce(new Promise(resolve => { finishCatalog = resolve }))
  const view = render(<VisitsPage />, { wrapper: Cache })
  expect(getVisitsSettings).not.toHaveBeenCalled()
  selectSite("A")
  view.rerender(<VisitsPage />)
  const name = await screen.findByLabelText("visits.fields.fullName")
  expect(getVisitsSettings).toHaveBeenCalledWith("A")
  expect(screen.queryByText("visits.resource.empty")).not.toBeInTheDocument()
  noResourceReads()

  fireEvent.change(name, { target: { value: "First name" } })
  fireEvent.change(identityField("email"), { target: { value: "invalid" } })
  expect(identityNext()).toBeDisabled()
  expect(identityField("email")).toHaveAttribute("aria-invalid", "true")
  noResourceReads()

  fireEvent.change(identityField("phone"), { target: { value: "invalid" } })
  fireEvent.change(identityField("email"), { target: { value: "visitor@example.test" } })
  expect(identityNext()).toBeDisabled()
  noResourceReads()
  fireEvent.change(identityField("phone"), { target: { value: "" } })
  expect(identityNext()).toBeEnabled()
  expect(await screen.findByRole("status")).toHaveTextContent("common.loading")
  expect(screen.queryByText("visits.resource.empty")).not.toBeInTheDocument()
  name.focus()
  fireEvent.change(name, { target: { value: "Updated name" } })
  await act(async () => finishCatalog(catalog("A")))
  expect(identityField("fullName")).toBe(name)
  expect(name).toHaveFocus()
  for (const read of [listCatalogItems, listLocations, listVisitEmployees, listReservationSchedules]) {
    expect(read).toHaveBeenCalledTimes(1)
  }
  expect(listCatalogItems).toHaveBeenCalledWith({ siteId: "A", isReservation: true, pageSize: 100 })
  for (const read of [listLocations, listVisitEmployees, listReservationSchedules]) expect(read).toHaveBeenCalledWith("A")

  fireEvent.click(identityNext())
  fireEvent.click(screen.getByRole("button", { name: "Service A · 45 min" }))
  const complete = screen.getByRole("button", { name: "visits.actions.complete" })
  expect(complete).toBeDisabled()
  expect(registerVisit).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("checkbox", { name: "visits.terms.agree" }))
  await act(async () => { fireEvent.click(complete) })
  expect(registerVisit).toHaveBeenCalledTimes(1)
  expect(registerVisit).toHaveBeenCalledWith(expect.objectContaining({
    siteId: "A", visitorName: "Updated name", visitorEmail: "visitor@example.test", resourceType: "catalog_item",
    catalogItemId: "service-A", durationMinutes: null, termsAccepted: true, acceptedTermsText: "Site terms",
  }))
  expect(screen.queryByRole("heading", { name: "visits.success.title" })).not.toBeInTheDocument()
})

it("requires the new site's own identity and ignores a late previous-site resource response", async () => {
  let finishCatalog!: (value: ReturnType<typeof catalog>) => void
  jest.mocked(listCatalogItems).mockReturnValueOnce(new Promise(resolve => { finishCatalog = resolve }))
  const view = render(<VisitsPage />, { wrapper: Cache })
  fireEvent.change(await screen.findByLabelText("visits.fields.fullName"), { target: { value: "Visitor A" } })
  fireEvent.change(identityField("phone"), { target: { value: "+15551234567" } })
  fireEvent.click(identityNext())
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalledTimes(1))

  selectSite("B")
  view.rerender(<VisitsPage />)
  expect(await screen.findByLabelText("visits.fields.fullName")).toHaveValue("")
  expect(identityNext()).toBeDisabled()
  expect(listCatalogItems).toHaveBeenCalledTimes(1)
  fireEvent.change(identityField("fullName"), { target: { value: "Visitor B" } })
  fireEvent.change(identityField("phone"), { target: { value: "+15557654321" } })
  expect(await screen.findByRole("button", { name: "Service B" })).toBeInTheDocument()
  await act(async () => finishCatalog(catalog("A")))
  expect(screen.queryByRole("button", { name: /Service A/ })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Service B" })).toBeInTheDocument()
  expect(identityField("fullName")).toHaveValue("Visitor B")
  expect(registerVisit).not.toHaveBeenCalled()
})

it("keeps reservation attestation on its scoped read and never loads walk-in options", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("reservationId=other") as ReturnType<typeof useSearchParams>)
  jest.mocked(getReservationForVisit).mockResolvedValue({ error: "Reservation not found" })
  render(<VisitsPage />, { wrapper: Cache })
  expect(await screen.findByText("Reservation not found")).toBeInTheDocument()
  expect(getReservationForVisit).toHaveBeenCalledWith("A", "other")
  noResourceReads()
  expect(attestReservation).not.toHaveBeenCalled()
  expect(registerVisit).not.toHaveBeenCalled()
})

it("does not offer a disabled physical channel or start picker reads for it", async () => {
  jest.mocked(getVisitsSettings).mockResolvedValue({ data: { ...settings, enabled_physical: false } })
  render(<VisitsPage />, { wrapper: Cache })
  expect(await screen.findByText("visits.unavailable")).toBeInTheDocument()
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  noResourceReads()
  expect(registerVisit).not.toHaveBeenCalled()
})

it("keeps buyer startup independent of the kiosk identity gate", async () => {
  render(<VisitRegistrationForm siteId="A" mode="buyer" />, { wrapper: Cache })
  await screen.findByRole("heading", { name: "visits.steps.identity.title" })
  expect(identityNext()).toBeDisabled()
  for (const read of [listCatalogItems, listLocations, listVisitEmployees, listReservationSchedules]) {
    expect(read).toHaveBeenCalledTimes(1)
  }
  expect(registerBuyerVisit).not.toHaveBeenCalled()
})