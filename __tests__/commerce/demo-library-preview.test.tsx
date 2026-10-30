import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DemoLibraryDetail } from "@/app/home/demo-library-detail"
import { BuyerLibraryExperience } from "@/app/buyer/components/BuyerLibraryExperience"
import { PassPdpLayout } from "@/app/components/commerce/pdp/PassPdpLayout"
import { CourseExperienceClient } from "@/app/buyer/course/[entitlementId]/CourseExperienceClient"
import { getDemoLibraryData } from "@/app/home/demo-library-data"
import { demoAccountLibrary } from "@/app/home/demo-commerce"
import { getActiveDigitalEntitlementForCatalogItem, resolveBookableAccess } from "@/app/buyer/entitlement-queries"
import { getReservationSlotsLocalFirst } from "@/app/pos/local/reservation-slots"
import { bookWithEntitlement } from "@/app/commerce/redeem-reservation"
import { saveCourseProgress } from "@/app/commerce/course-progress"
import { downloadAccessPass } from "@/app/lib/download-access-pass"
import { toast } from "sonner"
import { TextEncoder } from "node:util"

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }), usePathname: () => "",
  notFound: () => { throw new Error("NEXT_NOT_FOUND") },
}))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: (key: string) => ({
    "pdp.course.markComplete": "Mark complete", "pdp.course.completed": "Completed",
  }[key] || key) }),
}))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null }) }))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({ useDisplayCurrency: () => ({ formatPrice: () => "$0" }) }))
jest.mock("@/app/buyer/entitlement-queries", () => ({
  getActiveDigitalEntitlementForCatalogItem: jest.fn(), resolveBookableAccess: jest.fn(),
}))
jest.mock("@/app/pos/local/reservation-slots", () => ({ getReservationSlotsLocalFirst: jest.fn() }))
jest.mock("@/app/commerce/redeem-reservation", () => ({ bookWithEntitlement: jest.fn() }))
jest.mock("@/app/commerce/course-progress", () => ({ saveCourseProgress: jest.fn().mockResolvedValue({ success: true }) }))
jest.mock("@/app/lib/download-access-pass", () => ({ downloadAccessPass: jest.fn().mockResolvedValue(undefined) }))
jest.mock("@/app/reservations/actions", () => ({ upsertReservation: jest.fn(), validateReservationSlot: jest.fn() }))
jest.mock("sonner", () => ({ toast: { info: jest.fn(), success: jest.fn(), error: jest.fn() } }))
jest.mock("react-markdown", () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("remark-gfm", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("remark-breaks", () => ({ __esModule: true, default: jest.fn() }))
jest.mock("@/app/components/commerce/pdp/SubscriptionManagePanel", () => ({ SubscriptionManagePanel: () => null }))
jest.mock("@/app/components/commerce/CommerceShellHeader", () => ({
  CommerceShellHeader: ({ brand, center, actions }: { brand: React.ReactNode; center: React.ReactNode; actions: React.ReactNode }) =>
    <header>{brand}{center}{actions}</header>,
}))

beforeEach(() => {
  Object.assign(globalThis, { TextEncoder })
  jest.clearAllMocks()
  jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it("dispatches every existing library row to the live presentation component and rejects unknown IDs", () => {
  for (const row of demoAccountLibrary) {
    const detail = DemoLibraryDetail({ id: row.id })
    expect(detail.type).toBe(row.catalog_item.digital_subtype === "course" ? CourseExperienceClient : BuyerLibraryExperience)
  }
  expect(() => DemoLibraryDetail({ id: "demo-ticket-99" })).toThrow("NEXT_NOT_FOUND")
  expect(() => DemoLibraryDetail({ id: "unknown" })).toThrow("NEXT_NOT_FOUND")
})

it("renders the production ticket details and QR with a deliberately invalid demo token and local download", async () => {
  const { container } = render(<DemoLibraryDetail id="demo-ticket-1" />)
  expect(screen.getByRole("heading", { name: "Community summit 1" })).toBeInTheDocument()
  expect(screen.getByText("Acme Workplace")).toBeInTheDocument()
  expect(screen.getByText("demo-ticket-1")).toBeInTheDocument()
  expect(container.querySelector("svg")).toBeInTheDocument()
  expect(getDemoLibraryData("demo-ticket-1")?.entitlement.metadata.ticket_token).toMatch(/^DEMO-ONLY-NOT-VALID-/)
  fireEvent.click(screen.getByRole("button", { name: "buyer.reservations.downloadPass" }))
  await waitFor(() => expect(downloadAccessPass).toHaveBeenCalledWith(expect.objectContaining({
    codeLabel: "DEMO-ONLY-NOT-VALID-demo-ticket-1", kind: "ticket",
  })))
  expect(getActiveDigitalEntitlementForCatalogItem).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("renders actual download rows using local sample data rather than storage or download APIs", () => {
  render(<DemoLibraryDetail id="demo-file-1" />)
  expect(screen.getByRole("heading", { name: "Brand resource pack 1" })).toBeInTheDocument()
  const links = screen.getAllByRole("link", { name: "pdp.download" })
  expect(links).toHaveLength(2)
  for (const link of links) {
    expect(link.getAttribute("href")).toMatch(/^data:text\/plain/)
    expect(link).toHaveAttribute("download")
  }
  expect(getActiveDigitalEntitlementForCatalogItem).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("uses the live pass booking calendar with injected slots and never books or deducts uses", async () => {
  render(<DemoLibraryDetail id="demo-pass-1" />)
  expect(screen.getByText("Studio workspace session")).toBeInTheDocument()
  expect(screen.getByText(/5 buyer.library.usesRemaining/)).toBeInTheDocument()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const availableDay = () => screen.getAllByRole("button", { name: String(tomorrow.getDate()) })
    .find(button => !(button as HTMLButtonElement).disabled)!
  await waitFor(() => expect(availableDay()).toBeDefined())
  fireEvent.click(availableDay())
  const time = await screen.findByRole("button", { name: /10:00/ })
  fireEvent.click(time)
  expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("No reservation was created"))
  expect(getReservationSlotsLocalFirst).not.toHaveBeenCalled()
  expect(resolveBookableAccess).not.toHaveBeenCalled()
  expect(bookWithEntitlement).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("uses the live lesson player and keeps demo progress local without saving it", () => {
  render(<DemoLibraryDetail id="demo-course-1" />)
  expect(screen.getByRole("heading", { name: "Product design foundations 1" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Welcome to product design" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }))
  expect(screen.getByRole("button", { name: "Completed" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: /2. Understand the problem/ }))
  expect(screen.getByRole("heading", { name: "Understand the problem before the solution" })).toBeInTheDocument()
  expect(saveCourseProgress).not.toHaveBeenCalled()
  expect(getActiveDigitalEntitlementForCatalogItem).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it("preserves authenticated course persistence when demo mode is absent", async () => {
  const data = getDemoLibraryData("demo-course-1")!
  render(<CourseExperienceClient item={data.item} entitlement={data.entitlement} backUrl="/buyer/library" />)
  fireEvent.click(screen.getByRole("button", { name: "Mark complete" }))
  await waitFor(() => expect(saveCourseProgress).toHaveBeenCalledWith("demo-course-1", { lastIndex: 0, completedIndexes: [0] }))
})

it("does not query pass ownership for a demo subscription experience", () => {
  const data = getDemoLibraryData("demo-pass-1")!
  render(<PassPdpLayout item={{ ...data.item, is_recurring: true }} backUrl="/home/subscriptions"
    experience={{ kind: "subscription", demo: true, subscription: { id: "demo-subscription-1", status: "active" } }} />)
  expect(resolveBookableAccess).not.toHaveBeenCalled()
  expect(getActiveDigitalEntitlementForCatalogItem).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})