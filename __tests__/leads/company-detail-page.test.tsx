import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import LeadDetailPage from "@/app/leads/[id]/page"
import { getLeadById, updateLead } from "@/app/leads/actions"
import { getCompanies, getCompanyById } from "@/app/companies/actions"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { toast } from "sonner"
import type { Company } from "@/app/companies/types"
import type { Lead } from "@/app/leads/types"
import type { SingleLeadResponse } from "@/app/leads/action-schemas"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/leads/actions", () => ({ getLeadById: jest.fn(), updateLead: jest.fn(), deleteLead: jest.fn() }))
jest.mock("@/app/segments/actions", () => ({ getSegments: async () => ({ segments: [] }) }))
jest.mock("@/app/campaigns/actions/campaigns/read", () => ({ getCampaigns: async () => ({ data: [] }) }))
jest.mock("@/app/companies/actions", () => ({ getCompanies: jest.fn(), getCompanyById: jest.fn(), updateCompany: jest.fn() }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/leads/components/LeadDetail", () => ({
  LeadDetail: (props: { lead: Lead; onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void> }) => {
    const { CompanyTab } = jest.requireActual("@/app/leads/components/CompanyTab")
    return <CompanyTab {...props} showEmpty={false} onToggleEmpty={() => {}} />
  },
}))
jest.mock("@/app/leads/components/LeadIdentityHeader", () => ({
  LeadIdentityHeader: ({ lead }: { lead: Lead }) => <div data-testid="header-company">
    {lead.company?.name || lead.companies?.name || "No company"}
  </div>,
}))
jest.mock("@/app/leads/components/JourneyView", () => ({ JourneyView: () => null }))
jest.mock("@/app/leads/components/ConversationsView", () => ({ ConversationsView: () => null }))
jest.mock("@/app/leads/components/SalesView", () => ({ SalesView: () => null }))
jest.mock("@/app/leads/components/CommerceView", () => ({ CommerceView: () => null }))
jest.mock("@/app/leads/components/DigitalBehaviorView", () => ({ DigitalBehaviorView: () => null }))
jest.mock("@/app/leads/components/DealsView", () => ({ DealsView: () => null }))
jest.mock("@/app/leads/components/LeadDetailSkeleton", () => ({ LeadDetailSkeleton: () => null }))
jest.mock("@/app/leads/components/StatusSegmentBar", () => ({ StatusSegmentBar: () => null }))
jest.mock("@/app/leads/components/AttributionModal", () => ({ AttributionModal: () => null }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/responsive-tabs-list", () => ({ ResponsiveTabsList: () => null }))

const oldCompany: Company = { id: "company-old", name: "Old Company", created_at: "2026-01-01", updated_at: "2026-01-01" }
const newCompany: Company = { ...oldCompany, id: "company-new", name: "New Company" }
const lead: Lead = {
  id: "lead-a", name: "Test Lead", company_id: oldCompany.id, company: oldCompany,
  email: "lead@example.com", personal_email: null, phone: null, position: null,
  segment_id: null, campaign_id: null, status: "new", created_at: "2026-01-01",
  updated_at: "2026-01-01", last_contact: null, origin: null, birthday: null,
  language: null, social_networks: null, address: null, notes: null,
}
const params = Promise.resolve({ id: lead.id })

async function open() {
  render(<LeadDetailPage params={params} />)
  await waitFor(() => expect(screen.queryByText("Loading company...")).not.toBeInTheDocument())
  const name = await screen.findByText("Old Company", { selector: "div[title]" })
  await act(async () => fireEvent.click(name))
  fireEvent.change(screen.getByPlaceholderText("Select company..."), { target: { value: "New Company" } })
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(React, "use").mockReturnValue({ id: lead.id })
  jest.mocked(getLeadById).mockResolvedValue({ lead } as SingleLeadResponse)
  jest.mocked(updateLead).mockResolvedValue({ success: true })
  jest.mocked(getCompanies).mockResolvedValue({ companies: [oldCompany], error: null })
  jest.mocked(getCompanyById).mockImplementation(async (id) => ({ company: id === oldCompany.id ? oldCompany : newCompany, error: null }))
  jest.mocked(resolveRelationId).mockImplementation(async (_entity, value) => ({
    id: value?.mode === "existing" ? value.id : value ? newCompany.id : null, error: null,
  }))
})
afterEach(() => jest.restoreAllMocks())

it("sends the resolved company ID to the lead mutation and refreshes the header and editor", async () => {
  await open()
  fireEvent.click(screen.getByText('Use "New Company"'))
  fireEvent.click(screen.getByRole("button", { name: "Save company" }))
  await waitFor(() => expect(screen.getByTestId("header-company")).toHaveTextContent("New Company"))
  expect(updateLead).toHaveBeenCalledWith({ id: lead.id, site_id: "site-a", company_id: newCompany.id })
  expect(screen.queryByText("Old Company")).not.toBeInTheDocument()
  const name = await screen.findByText("New Company", { selector: "div[title]" })
  await act(async () => fireEvent.click(name))
  expect(screen.getByPlaceholderText("Select company...")).toHaveValue("New Company")
})

it.each(["response", "exception"])("retains the company draft and previous header after an update %s failure", async (failure) => {
  jest.spyOn(console, "error").mockImplementation(() => {})
  if (failure === "response") jest.mocked(updateLead).mockResolvedValueOnce({ error: "Write denied" })
  else jest.mocked(updateLead).mockRejectedValueOnce(new Error("Write failed"))
  await open()
  fireEvent.click(screen.getByRole("button", { name: "Save company" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save field"))
  expect(screen.getByPlaceholderText("Select company...")).toHaveValue("New Company")
  expect(screen.getByTestId("header-company")).toHaveTextContent("Old Company")
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Save company" }))
  await waitFor(() => expect(screen.getByTestId("header-company")).toHaveTextContent("New Company"))
})

it("clears relation metadata in the header when the company is unlinked", async () => {
  await open()
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
  fireEvent.click(screen.getByRole("button", { name: "Save company" }))
  await waitFor(() => expect(screen.getByTestId("header-company")).toHaveTextContent("No company"))
  expect(updateLead).toHaveBeenCalledWith({ id: lead.id, site_id: "site-a", company_id: null })
  expect(screen.queryByText("Old Company")).not.toBeInTheDocument()
})