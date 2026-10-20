import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { TeamLocationAccess } from "@/app/components/settings/TeamLocationAccess"

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSiteId = "00000000-0000-4000-8000-000000000002"
const memberId = "00000000-0000-4000-8000-000000000003"
const locationId = "00000000-0000-4000-8000-000000000004"
const members = [{ id: memberId, email: "operator@example.test", role: "create" as const }]
const payload = {
  success: true, site_id: siteId, editing_enabled: false,
  locations: [{ id: locationId, name: "Branch A", is_active: false }],
  members: [{ id: memberId, role: "collaborator", is_location_exempt: false, restricted_location_ids: [locationId] }],
}
function respond(body: unknown, ok = true, status = ok ? 200 : 503) {
  return { ok, status, json: async () => body } as Response
}

describe("team location access readiness", () => {
  beforeEach(() => { jest.mocked(fetch).mockReset() })

  it("shows verified restrictions without enabling editing or losing inactive locations", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(payload))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Branch A · inactive")).toBeInTheDocument()
    expect(screen.getByText("operator@example.test")).toBeInTheDocument()
    expect(screen.getByText("Editing unavailable")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`/api/site-members/${siteId}/location-restrictions`, expect.objectContaining({ cache: "no-store" }))
  })

  it("distinguishes lookup failure from a verified empty restriction list and allows refresh", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond({ success: false }, false)).mockResolvedValueOnce(respond({
      ...payload, members: [{ ...payload.members[0], restricted_location_ids: [] }],
    }))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Location access could not be verified. No restriction list is available.")).toBeInTheDocument()
    expect(screen.queryByText("No additional location restrictions")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Refresh location access" }))
    expect(await screen.findByText("No additional location restrictions")).toBeInTheDocument()
  })

  it("does not display previous-site permissions or apply a late response after switching sites", async () => {
    let resolveFirst!: (value: Response) => void
    jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValueOnce(respond({ ...payload, site_id: otherSiteId, members: [] }))
    const { rerender } = render(<TeamLocationAccess siteId={siteId} members={members} />)
    rerender(<TeamLocationAccess siteId={otherSiteId} members={members} />)
    await act(async () => { resolveFirst(respond(payload)) })
    expect(screen.queryByText("Branch A · inactive")).not.toBeInTheDocument()
    expect(screen.queryByText("operator@example.test")).not.toBeInTheDocument()
  })

  it("rejects foreign tenant responses even with a successful HTTP result", async () => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, site_id: otherSiteId }))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Location access could not be verified. No restriction list is available.")).toBeInTheDocument()
  })

  it("shows database setup pending rather than claiming unrestricted access before migration", async () => {
    jest.mocked(fetch).mockResolvedValue(respond({ code: "LOCATION_ACCESS_SCHEMA_UNAVAILABLE" }, false))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText(/Location access database setup is pending/)).toBeInTheDocument()
    expect(screen.queryByText("No additional location restrictions")).not.toBeInTheDocument()
  })

  it("does not call nullable location activity inactive", async () => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, locations: [{ ...payload.locations[0], is_active: null }] }))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Branch A · status unknown")).toBeInTheDocument()
  })

  it("uses effective ownership exemption rather than the stored role label", async () => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, members: [{ ...payload.members[0], is_location_exempt: true }] }))
    render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Owner/admin · location restrictions do not apply")).toBeInTheDocument()
    expect(screen.queryByText("Branch A · inactive")).not.toBeInTheDocument()
  })

  it("refreshes persisted configuration when membership roles change", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockResolvedValueOnce(respond({
      ...payload, members: [{ ...payload.members[0], role: "admin", is_location_exempt: true }],
    }))
    const { rerender } = render(<TeamLocationAccess siteId={siteId} members={members} />)
    expect(await screen.findByText("Branch A · inactive")).toBeInTheDocument()
    rerender(<TeamLocationAccess siteId={siteId} members={[{ ...members[0], role: "admin" }]} />)
    expect(await screen.findByText("Owner/admin · location restrictions do not apply")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})