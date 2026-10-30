import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SupplierDetail } from "@/app/suppliers/components/supplier-detail"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { contactLinks, safeCompanyUrl } from "@/app/suppliers/components/contact-links"

jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key, locale: "en" }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: null }) }))

const site = "00000000-0000-4000-8000-000000000001"
const id = "00000000-0000-4000-8000-000000000002"
const company = {
  id: "00000000-0000-4000-8000-000000000003", name: "Full Company", legal_name: "Full Company LLC",
  email: "company@example.test", phone: "+1 512 555 0142", website: "company.example", linkedin_url: "https://linkedin.com/company/full",
  industry: "technology", size: "51-200", employees_count: 85, annual_revenue: "1M-10M", founded: "2001",
  description: "Complete business profile", tax_id: "TAX-001", tax_country: "US", registration_number: "REG-01", vat_number: "VAT-01",
  legal_structure: "llc", is_public: false, stock_symbol: "FULL", parent_company_id: "parent-id",
  address: { street: "Main Street 10", city: "Austin", state: "TX", zipcode: "78701", country: "US" },
  created_at: "2025-01-01", updated_at: "2026-01-01",
}
const supplier = {
  id, site_id: site, name: "Full Supplier", status: "approved", company_id: company.id, version: 3,
  commercial_terms: "Net 30", private_notes: "Workspace notes", category_ids: [],
  contacts: [{ name: "Primary Person", email: "person@example.test", phone: "+1 737 555 0184", role: "Director", is_primary: true }],
  created_at: "2026-10-05", updated_at: "2026-10-29",
}
const response = (value: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => value }) as Response

beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => {
  global.fetch = jest.fn(async url => {
    if (String(url).includes("/company?")) return response({ company })
    if (String(url).includes("/references")) return response({ options: [], has_more: false })
    return response({ supplier, can_edit: false })
  })
})

it("shows all available supplier and company profile fields with contact actions, not add actions", async () => {
  render(<><TopBarPrimaryActionsSlot /><SupplierDetail siteId={site} id={id} /></>)
  await screen.findByRole("heading", { name: supplier.name, level: 2 })
  const aside = screen.getByRole("complementary")
  for (const text of [supplier.created_at, supplier.updated_at]) {
    expect(within(aside).getByText(text)).toBeInTheDocument()
  }
  const tab = (name: string) => fireEvent.mouseDown(within(aside).getByRole("tab", { name }), { button: 0, ctrlKey: false })
  tab("Company")
  await within(aside).findByText("Full Company LLC")
  expect(within(aside).getByText("85")).toBeInTheDocument()
  tab("Info")
  expect(within(aside).getByText("Main Street 10")).toBeInTheDocument()
  expect(within(aside).getByText("TAX-001")).toBeInTheDocument()
  expect(within(aside).getByText("No")).toBeInTheDocument()
  expect(within(aside).queryByRole("tab", { name: "Address" })).not.toBeInTheDocument()
  expect(within(aside).queryByRole("tab", { name: "Legal" })).not.toBeInTheDocument()
  tab("Contacts")
  expect(within(aside).getByText("person@example.test")).toBeInTheDocument()
  const actions = screen.getByRole("heading", { name: supplier.name, level: 2 }).closest("header")!
  expect(within(actions).getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:person%40example.test")
  expect(within(actions).getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+17375550184")
  expect(within(actions).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/17375550184")
  expect(within(actions).queryByRole("button", { name: "Back to suppliers" })).not.toBeInTheDocument()
  expect(document.getElementById("page-primary-actions")).toBeEmptyDOMElement()
  expect(screen.queryByRole("button", { name: "Create supplier" })).not.toBeInTheDocument()
  fireEvent.mouseDown(screen.getAllByRole("tab", { name: "Contacts" })[0], { button: 0, ctrlKey: false })
  expect(screen.queryByRole("button", { name: "Add contact" })).not.toBeInTheDocument()
  expect(within(aside).queryByRole("textbox")).not.toBeInTheDocument()
})

it("distinguishes failed company enrichment and retries without losing supplier details", async () => {
  jest.mocked(fetch).mockImplementation(async url => {
    if (String(url).includes("/company?")) return response({}, false)
    if (String(url).includes("/references")) return response({ options: [] })
    return response({ supplier, can_edit: false })
  })
  render(<SupplierDetail siteId={site} id={id} />)
  await screen.findByRole("heading", { name: supplier.name, level: 2 })
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Company" }), { button: 0, ctrlKey: false })
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load linked company details")
  expect(screen.getByRole("heading", { name: "Full Supplier", level: 2 })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry company details" }))
  await waitFor(() => expect(jest.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("/company?")).length).toBe(2))
})

it("rejects malformed email, phone and executable external targets", () => {
  expect(contactLinks({ email: "bad\n@example.test", phone: "javascript:alert(1)" })).toEqual({ email: null, call: null, whatsapp: null })
  expect(contactLinks({ email: "valid@example.test", phone: "512-555-0142" }).whatsapp).toBeNull()
  expect(safeCompanyUrl("javascript:alert(1)")).toBeUndefined()
  expect(safeCompanyUrl("https://user:pass@example.test")).toBeUndefined()
})