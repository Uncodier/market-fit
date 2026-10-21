import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { LocationScopeEditor } from "@/app/components/LocationScopeEditor"

jest.mock("@/app/components/ui/button", () => ({ Button: ({ children, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => <button data-variant={variant} {...props}>{children}</button> }))

const siteId = "11111111-1111-4111-8111-111111111111"
const id = "22222222-2222-4222-8222-222222222222"
const locationId = "33333333-3333-4333-8333-333333333333"
const otherSite = "44444444-4444-4444-8444-444444444444"
const data = { site_id: siteId, table: "deals", page: 0, hasMore: false,
  records: [{ id, label: "Annual contract", location_id: null }],
  locations: [{ id: locationId, name: "North branch", is_active: true }] }
const response = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body })
const fetchMock = jest.fn()

describe("canonical location scope editor", () => {
  beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; fetchMock.mockResolvedValue(response(data)) })

  it("requires actual record and branch selection, then confirms server-owned assignment", async () => {
    render(<LocationScopeEditor siteId={siteId} />)
    await screen.findByRole("option", { name: "Annual contract" })
    expect(screen.getByRole("button", { name: "Assign branch" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Unresolved record"), { target: { value: id } })
    expect(screen.getByLabelText("Operating branch")).toHaveValue("")
    fireEvent.change(screen.getByLabelText("Operating branch"), { target: { value: locationId } })
    fetchMock.mockResolvedValueOnce(response({ table: "deals", id, site_id: siteId, location_id: locationId }))
    fetchMock.mockResolvedValueOnce(response({ ...data, records: [] }))
    fireEvent.click(screen.getByRole("button", { name: "Assign branch" }))
    await screen.findByText("Location scope assigned.")
    expect(fetchMock).toHaveBeenCalledWith(`/api/location-scope?siteId=${siteId}`, expect.objectContaining({
      method: "POST", body: JSON.stringify({ table: "deals", id, locationId }),
    }))
    await screen.findByText("No unresolved records on this page.")
  })

  it("shows nonmanager denial without displaying operational records", async () => {
    fetchMock.mockResolvedValue(response({ error: "Forbidden" }, false, 403))
    render(<LocationScopeEditor siteId={siteId} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Only site owners and admins")
    expect(screen.queryByLabelText("Unresolved record")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assign branch" })).toBeDisabled()
  })

  it("requires refresh after an ambiguous assignment and never automatically replays POST", async () => {
    render(<LocationScopeEditor siteId={siteId} />)
    await screen.findByRole("option", { name: "Annual contract" })
    fireEvent.change(screen.getByLabelText("Unresolved record"), { target: { value: id } })
    fireEvent.change(screen.getByLabelText("Operating branch"), { target: { value: locationId } })
    fetchMock.mockRejectedValueOnce(new Error("Network interrupted"))
    fireEvent.click(screen.getByRole("button", { name: "Assign branch" }))
    await screen.findByRole("alert")
    expect(screen.getByRole("button", { name: "Assign branch" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await screen.findByRole("option", { name: "Annual contract" })
    expect(screen.getByLabelText("Unresolved record")).toHaveValue("")
  })

  it("ignores a prior tenant's late response", async () => {
    let finish!: (value: unknown) => void
    fetchMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const view = render(<LocationScopeEditor siteId={siteId} />)
    fetchMock.mockResolvedValueOnce(response({ ...data, site_id: otherSite, records: [] }))
    view.rerender(<LocationScopeEditor siteId={otherSite} />)
    await screen.findByText("No unresolved records on this page.")
    await act(async () => { finish(response(data)) })
    expect(screen.queryByRole("option", { name: "Annual contract" })).not.toBeInTheDocument()
  })

  it("shows known detail scope read-only without reassigning it", async () => {
    fetchMock.mockResolvedValue(response({ ...data, records: [{ id, label: "Annual contract", location_id: locationId }] }))
    render(<LocationScopeEditor siteId={siteId} table="deals" recordId={id} />)
    await screen.findByText("Assigned branch: North branch")
    expect(screen.queryByLabelText("Operating branch")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Assign branch" })).toBeDisabled()
  })
})