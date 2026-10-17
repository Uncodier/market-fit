import React, { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CompanyTab } from "@/app/leads/components/CompanyTab"
import { getCompanies, getCompanyById } from "@/app/companies/actions"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { toast } from "sonner"
import type { Company } from "@/app/companies/types"
import type { Lead } from "@/app/leads/types"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-a" } }) }))
jest.mock("@/app/companies/actions", () => ({ getCompanies: jest.fn(), getCompanyById: jest.fn(), updateCompany: jest.fn() }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const oldCompany: Company = { id: "company-old", name: "Old Company", created_at: "2026-01-01", updated_at: "2026-01-01" }
const newCompany: Company = { ...oldCompany, id: "company-new", name: "New Company", website: "https://example.com" }
const onUpdateLead = jest.fn<Promise<void>, [string, Partial<Lead>]>()

function Harness({ linked = true }: { linked?: boolean }) {
  const [lead, setLead] = useState({
    id: "lead-a", company_id: linked ? oldCompany.id : null, company: linked ? oldCompany : null,
  } as Lead)
  return <CompanyTab
    lead={lead}
    showEmpty={false}
    onToggleEmpty={() => {}}
    onUpdateLead={async (id, data) => {
      await onUpdateLead(id, data)
      setLead((previous) => ({ ...previous, ...data }))
    }}
  />
}

async function open(linked = true) {
  render(<Harness linked={linked} />)
  if (linked) await waitFor(() => expect(screen.queryByText("Loading company...")).not.toBeInTheDocument())
  await act(async () => fireEvent.click(screen.getByText(linked ? "Old Company" : "Not specified")))
  await waitFor(() => expect(getCompanies).toHaveBeenCalled())
  return screen.getByPlaceholderText("Select company...")
}

beforeEach(() => {
  jest.clearAllMocks()
  onUpdateLead.mockResolvedValue(undefined)
  jest.mocked(getCompanies).mockResolvedValue({ companies: [oldCompany], error: null })
  jest.mocked(getCompanyById).mockImplementation(async (id) => ({ company: id === oldCompany.id ? oldCompany : newCompany, error: null }))
  jest.mocked(resolveRelationId).mockImplementation(async (_entity, value) => ({
    id: value?.mode === "existing" ? value.id : value ? newCompany.id : null, error: null,
  }))
})

describe("lead company editing", () => {
  it.each([true, false])("keeps Use selection and saves a new company (previously linked: %s)", async (linked) => {
    const input = await open(linked)
    fireEvent.change(input, { target: { value: "New Company" } })
    fireEvent.click(screen.getByText('Use "New Company"'))
    expect(input).toHaveValue("New Company")
    expect(resolveRelationId).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(onUpdateLead).toHaveBeenCalledWith("lead-a", { company_id: newCompany.id }))
    expect(resolveRelationId).toHaveBeenCalledWith("company", { mode: "create", label: "New Company" }, "site-a")
    await screen.findByText("New Company")
    await screen.findByText("example.com")
    fireEvent.click(screen.getByText("New Company"))
    expect(screen.getByPlaceholderText("Select company...")).toHaveValue("New Company")
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenLastCalledWith("company", {
      mode: "existing", id: newCompany.id, label: "New Company",
    }, "site-a"))
  })

  it("saves a typed name without requiring Use and preserves whitespace while typing", async () => {
    const input = await open()
    fireEvent.change(input, { target: { value: "New " } })
    expect(input).toHaveValue("New ")
    fireEvent.change(input, { target: { value: "New Company" } })
    expect(screen.getByText('Use "New Company"')).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenCalledWith("company", {
      mode: "create", label: "New Company",
    }, "site-a"))
    expect(onUpdateLead).toHaveBeenCalledWith("lead-a", { company_id: newCompany.id })
  })

  it("links an existing company selected from the options", async () => {
    jest.mocked(getCompanies).mockResolvedValue({ companies: [oldCompany, newCompany], error: null })
    const input = await open()
    fireEvent.change(input, { target: { value: "New" } })
    fireEvent.click(screen.getByText("New Company"))
    expect(input).toHaveValue("New Company")
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenCalledWith("company", {
      mode: "existing", id: newCompany.id, label: "New Company",
    }, "site-a"))
  })

  it("recognizes an exact typed existing name without requiring an option click", async () => {
    jest.mocked(getCompanies).mockResolvedValue({ companies: [oldCompany, newCompany], error: null })
    const input = await open()
    fireEvent.change(input, { target: { value: "new company" } })
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenCalledWith("company", {
      mode: "existing", id: newCompany.id, label: "new company",
    }, "site-a"))
  })

  it("uses Enter to select without prematurely saving the previous draft", async () => {
    const input = await open()
    fireEvent.change(input, { target: { value: "New Company" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(resolveRelationId).not.toHaveBeenCalled()
    expect(input).toHaveValue("New Company")
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenCalledWith("company", {
      mode: "create", label: "New Company",
    }, "site-a"))
  })

  it("cancels a pending new company without creating or changing the link", async () => {
    const input = await open()
    fireEvent.change(input, { target: { value: "New Company" } })
    fireEvent.click(screen.getByText('Use "New Company"'))
    fireEvent.click(screen.getByRole("button", { name: "Cancel company edit" }))
    expect(screen.getByText("Old Company")).toBeInTheDocument()
    expect(resolveRelationId).not.toHaveBeenCalled()
    expect(onUpdateLead).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByText("Old Company")))
    expect(screen.getByPlaceholderText("Select company...")).toHaveValue("Old Company")
  })

  it("restores the original company draft when its name is retyped after another name", async () => {
    const input = await open()
    fireEvent.change(input, { target: { value: "New Company" } })
    fireEvent.change(input, { target: { value: "Old Company" } })
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(resolveRelationId).toHaveBeenCalledWith("company", {
      mode: "existing", id: oldCompany.id, label: "Old Company",
    }, "site-a"))
  })

  it.each(["typing", "clear button"])("unlinks the company when cleared by %s", async (method) => {
    const input = await open()
    if (method === "typing") fireEvent.change(input, { target: { value: "" } })
    else fireEvent.click(screen.getByRole("button", { name: "Clear selection" }))
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(onUpdateLead).toHaveBeenCalledWith("lead-a", { company_id: null }))
    await screen.findByText("Not specified")
  })

  it.each(["resolve", "update", "missing id"])("retains the draft when saving fails at %s", async (failure) => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})
    try {
      if (failure === "resolve") jest.mocked(resolveRelationId).mockResolvedValueOnce({ id: null, error: "Creation failed" })
      if (failure === "missing id") jest.mocked(resolveRelationId).mockResolvedValueOnce({ id: null, error: null })
      if (failure === "update") onUpdateLead.mockRejectedValueOnce(new Error("Update failed"))
      const input = await open()
      fireEvent.change(input, { target: { value: "New Company" } })
      fireEvent.click(screen.getByText('Use "New Company"'))
      fireEvent.click(screen.getByRole("button", { name: "Save company" }))
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not save field"))
      expect(input).toHaveValue("New Company")
      expect(screen.getByRole("button", { name: "Save company" })).toBeEnabled()
      if (failure !== "update") expect(onUpdateLead).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
  })

  it("does not reset a pending create when company options finish loading", async () => {
    let finish!: (result: { companies: Company[]; error: null }) => void
    jest.mocked(getCompanies).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const input = await open()
    fireEvent.change(input, { target: { value: "New Company" } })
    fireEvent.click(screen.getByText('Use "New Company"'))
    await act(async () => finish({ companies: [oldCompany], error: null }))
    expect(input).toHaveValue("New Company")
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))
    await waitFor(() => expect(onUpdateLead).toHaveBeenCalledWith("lead-a", { company_id: newCompany.id }))
  })
})