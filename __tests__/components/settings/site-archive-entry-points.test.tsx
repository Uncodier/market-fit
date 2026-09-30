import { fireEvent, render, screen } from "@testing-library/react"
import { SiteForm } from "@/app/components/settings/site-form"
import { ContextForm } from "@/app/components/settings/context-form"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/lib/sites/archive-site-client", () => ({
  requestSiteArchive: jest.fn(),
  leaveArchivedSite: jest.fn(),
}))
jest.mock("@/app/components/settings/use-activity-hydration", () => ({ useActivityHydration: jest.fn() }))
jest.mock("react-dropzone", () => ({ useDropzone: () => ({}) }))
jest.mock("@/app/components/settings/GeneralSection", () => ({ GeneralSection: () => <div>Site Information</div> }))
jest.mock("@/app/components/settings/WebResourcesSection", () => ({ WebResourcesSection: () => <div>Web Resources</div> }))
jest.mock("@/app/components/settings/CompanySection", () => ({ CompanySection: () => null }))
jest.mock("@/app/components/settings/BrandingSection", () => ({ BrandingSection: () => null }))
jest.mock("@/app/components/settings/MarketingSection", () => ({ MarketingSection: () => null }))
jest.mock("@/app/components/settings/ShopSection", () => ({ ShopSection: () => null }))
jest.mock("@/app/components/settings/PrintersSection", () => ({ PrintersSection: () => null }))
jest.mock("@/app/components/settings/VisitsSection", () => ({ VisitsSection: () => null }))
jest.mock("@/app/components/settings/CustomerJourneySection", () => ({ CustomerJourneySection: () => null }))
jest.mock("@/app/components/settings/SocialSection", () => ({ SocialSection: () => null }))
jest.mock("@/app/components/settings/ChannelsSection", () => ({ ChannelsSection: () => null }))
jest.mock("@/app/components/settings/TeamSection", () => ({ TeamSection: () => null }))
jest.mock("@/app/components/settings/BillingSection", () => ({ BillingSection: () => null }))
jest.mock("@/app/components/settings/ActivitiesSection", () => ({ ActivitiesSection: () => null }))
jest.mock("@/app/components/settings/CalendarSection", () => ({ CalendarSection: () => null }))
jest.mock("@/app/components/settings/SecretsSection", () => ({ SecretsSection: () => null }))
jest.mock("@/app/components/settings/CopywritingSection", () => ({ CopywritingSection: () => null }))

const siteId = "11111111-1111-4111-8111-111111111111"
const ownerId = "22222222-2222-4222-8222-222222222222"

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useSite).mockReturnValue({
    currentSite: { id: siteId, name: "Test workspace", user_id: ownerId },
    isLoading: false,
  } as ReturnType<typeof useSite>)
  jest.mocked(useAuth).mockReturnValue({ user: { id: ownerId }, isLoading: false } as ReturnType<typeof useAuth>)
})

it("places archival after Web Resources in Settings General", () => {
  const onDeleteSite = jest.fn()
  render(<SiteForm activeSegment="general" siteId={siteId} onDeleteSite={onDeleteSite} />)

  expect(screen.getByText("Web Resources").compareDocumentPosition(
    screen.getByRole("heading", { name: "Danger Zone" }),
  ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole("button", { name: /delete site/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Archive site" }))
  expect(screen.getByLabelText("Account password")).toBeVisible()
  expect(onDeleteSite).not.toHaveBeenCalled()
})

it("replaces the legacy Context General deletion control with password-confirmed archival", () => {
  const onDeleteSite = jest.fn()
  render(<ContextForm activeSegment="general" siteId={siteId} onDeleteSite={onDeleteSite} />)

  expect(screen.queryByText(/Once you delete a site/)).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /delete site/i })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Archive site" }))
  expect(screen.getByLabelText("Account password")).toBeVisible()
  expect(onDeleteSite).not.toHaveBeenCalled()
})

it.each([SiteForm, ContextForm])("does not show the danger zone outside General (%#)", (SettingsForm) => {
  render(<SettingsForm activeSegment="branding" siteId={siteId} />)
  expect(screen.queryByRole("heading", { name: "Danger Zone" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Archive site" })).not.toBeInTheDocument()
})