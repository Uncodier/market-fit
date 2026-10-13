import {
  filterLeads,
  getCompanyKey,
  getCompanyName,
  getDefaultLeadSort,
  getLeadSortComparator,
  getMostAdvancedLead,
  groupLeadsByCompany,
  normalizeCompanyField,
  normalizeOrigin,
} from "@/app/leads/list-helpers"
import type { Lead, LeadFilters } from "@/app/leads/types"

const lead = (id: string, values: Partial<Lead> = {}): Lead => ({
  id, name: id, email: `${id}@example.com`, personal_email: null, phone: null,
  company_id: null, company: null, position: null, segment_id: null, campaign_id: null,
  status: "new", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  last_contact: null, origin: null, birthday: null, language: null,
  social_networks: null, address: null, notes: null, ...values,
})
const emptyFilters = (): LeadFilters => ({ status: [], segments: [], origin: [], journeyStages: [] })

describe("lead list extraction", () => {
  test.each([
    [null, "newest"], ["", "newest"], ["invalid", "newest"],
    ["created_at", "newest"], ["newest", "newest"], ["oldest", "oldest"],
    ["updated_at", "last_updated"], ["last_updated", "last_updated"],
    ["nearest_due_date", "nearest_due_date"],
  ])("keeps URL sort default %s -> %s", (value, expected) => {
    expect(getDefaultLeadSort(value)).toBe(expected)
  })

  it("keeps origin normalization", () => {
    expect(normalizeOrigin("lead_generation_workflow")).toBe("Makinari")
    expect(normalizeOrigin("website")).toBe("website")
    expect(normalizeOrigin("")).toBeNull()
    expect(normalizeOrigin(undefined)).toBeNull()
  })

  it("preserves company precedence and individual keys without a real company", () => {
    const related = lead("one", { company: { name: "JSON company" }, companies: { name: "Relation company" } })
    expect(getCompanyName(related)).toBe("Relation company")
    expect(getCompanyKey(related)).toBe("relation company")
    expect(getCompanyName(lead("one", { company: { name: " Acme " } }))).toBe(" Acme ")
    const legacy = lead("one", { company: " Acme " as unknown as Lead["company"] })
    expect(getCompanyKey(legacy)).toBe("acme")
    expect(getCompanyKey(lead("one"))).toBe("lead_one")
    expect(getCompanyKey(lead("two", { name: "one" }))).toBe("lead_two")
  })

  it("retains tab/status conflicts, advanced filters and default unaware stage", () => {
    const leads = [lead("one", { segment_id: "segment", origin: "website" }), lead("two", { status: "qualified" })]
    expect(filterLeads(leads, "new", { ...emptyFilters(), status: ["qualified"] }, {}, "", "newest")).toEqual([])
    const filters = { status: ["new"], segments: ["segment"], origin: ["website"], journeyStages: ["not_contacted"] }
    expect(filterLeads(leads, "all", filters, {}, "", "newest").map(l => l.id)).toEqual(["one"])
    expect(filterLeads(leads, "all", filters, { one: "awareness" }, "", "newest")).toEqual([])
  })

  it("keeps local search fields and excludes personal_email-only matches", () => {
    const leads = [lead("one", { company: { name: "Acme" } }), lead("two", { personal_email: "acme@example.com" })]
    expect(filterLeads(leads, "all", emptyFilters(), {}, " ACME ", "newest").map(l => l.id)).toEqual(["one"])
    for (const values of [{ name: "target" }, { email: "target" }, { position: "target" }, { phone: "target" }, { origin: "target" }]) {
      expect(filterLeads([lead("one", values)], "all", emptyFilters(), {}, "target", "newest")).toHaveLength(1)
    }
  })

  it("preserves the existing in-place no-filter sort and timestamp fallback", () => {
    const leads = [lead("old"), lead("new", { created_at: "2026-01-02T00:00:00Z", updated_at: "invalid" })]
    expect(filterLeads(leads, "all", emptyFilters(), {}, "", "newest")).toBe(leads)
    expect(leads.map(l => l.id)).toEqual(["new", "old"])
    expect([...leads].sort(getLeadSortComparator("oldest")).map(l => l.id)).toEqual(["old", "new"])
    expect([...leads].sort(getLeadSortComparator("last_updated")).map(l => l.id)).toEqual(["new", "old"])
  })

  it("sorts due dates by absolute distance and keeps missing/invalid dates last", () => {
    jest.spyOn(Date, "now").mockReturnValue(new Date("2026-01-10T00:00:00Z").getTime())
    const leads = [lead("missing"), lead("past", { last_contact: "2026-01-09T00:00:00Z" }), lead("future", { last_contact: "2026-01-12T00:00:00Z" })]
    expect(leads.sort(getLeadSortComparator("nearest_due_date")).map(l => l.id)).toEqual(["past", "future", "missing"])
    jest.restoreAllMocks()
  })

  it("groups normalized company keys and picks highest stage, then newest lead", () => {
    const leads = [lead("older", { company: { name: " Acme " } }), lead("newer", { company: { name: "acme" }, created_at: "2026-01-02T00:00:00Z" }), lead("individual")]
    const stages = { older: "purchase", newer: "awareness" }
    const groups = groupLeadsByCompany(leads, stages, { acme: true }, "newest")
    expect(groups[0]).toMatchObject({ companyKey: "acme", leadCount: 2, mostAdvancedStage: "purchase", isExpanded: true })
    expect(groups[0].leads.map(l => l.id)).toEqual(["newer", "older"])
    expect(groups[0].mostAdvancedLead.id).toBe("older")
    expect(getMostAdvancedLead(leads.slice(0, 2), {}).id).toBe("newer")
    expect(() => getMostAdvancedLead([], {})).toThrow("No leads provided")
  })

  it("normalizes update company fields without clearing linked companies", () => {
    expect(normalizeCompanyField(lead("one", { company_id: "linked" }))).toBeUndefined()
    expect(normalizeCompanyField(lead("one"))).toBeNull()
    expect(normalizeCompanyField(lead("one", { companies: { name: "Relation" } }))).toBe("Relation")
    expect(normalizeCompanyField(lead("one", { company: " Acme " as unknown as Lead["company"] }))).toBe("Acme")
    const company = { name: " Acme ", website: "", size: null, unknown: "drop", domain: " acme.test ", location: { city: "Paris" }, external_organization_id: 1, address: { street: "", city: "Paris" } }
    expect(normalizeCompanyField(lead("one", { company: company as unknown as Lead["company"] }))).toEqual({ name: "Acme", domain: "acme.test", location: { city: "Paris" }, external_organization_id: 1, address: { city: "Paris" } })
    expect(normalizeCompanyField(lead("one", { company: { website: "example.com" }, company_id: "linked" }))).toBeUndefined()
    expect(normalizeCompanyField(lead("one", { company: {} }))).toBeNull()
  })
})