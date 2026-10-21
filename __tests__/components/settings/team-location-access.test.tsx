import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useForm, FormProvider } from "react-hook-form"
import { TeamLocationAccess } from "@/app/components/settings/TeamLocationAccess"
import { MemberLocationRestrictions } from "@/app/components/settings/MemberLocationRestrictions"
import { TeamMemberCard } from "@/app/components/settings/TeamMemberCard"
import type { FormTeamMember } from "@/app/components/settings/team-types"
import { useAuthContext } from "@/app/components/auth/auth-context"

jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/components/settings/MemberBlockedScreens", () => ({ MemberBlockedScreens: () => <div>App access</div> }))
jest.mock("@/app/components/settings/MemberStatusControl", () => ({ MemberStatusControl: () => <div>Member status</div> }))

const siteId = "00000000-0000-4000-8000-000000000001"
const otherSiteId = "00000000-0000-4000-8000-000000000002"
const memberId = "00000000-0000-4000-8000-000000000003"
const locationId = "00000000-0000-4000-8000-000000000004"
const activeLocationId = "00000000-0000-4000-8000-000000000005"
const members: FormTeamMember[] = [{ id: memberId, email: "operator@example.test", role: "create", originalRole: "collaborator", status: "pending" }]
const payload = {
  success: true, site_id: siteId, editing_enabled: true,
  locations: [{ id: locationId, name: "Branch A", is_active: false }, { id: activeLocationId, name: "Branch B", is_active: true }],
  members: [{ id: memberId, role: "collaborator", is_location_exempt: false, restricted_location_ids: [locationId] }],
}
function respond(body: unknown, ok = true, status = ok ? 200 : 503) {
  return { ok, status, json: async () => body } as Response
}
function saved(ids = [locationId, activeLocationId]) {
  return respond({ success: true, site_id: siteId, site_member_id: memberId, restricted_location_ids: ids, revision: 1 })
}
function Harness({ site = siteId, team = members, manager = true }: { site?: string; team?: FormTeamMember[]; manager?: boolean }) {
  return <TeamLocationAccess siteId={site} members={team} canManageTeam={manager}>
    {team.map((member, index) => <MemberLocationRestrictions key={member.id || index} member={member} siteId={site} canManageTeam={manager} />)}
  </TeamLocationAccess>
}
function CardHarness({ team = members }: { team?: FormTeamMember[] }) {
  const form = useForm({ defaultValues: { team_members: team } })
  return <FormProvider {...form}><TeamLocationAccess siteId={siteId} members={team} canManageTeam>
    <TeamMemberCard siteId={siteId} member={team[0]} index={0} canManageTeam canEditBlockedScreens
      isLoading={false} isSaving={false} isSavingThis={false} isResendingThis={false} isUpdatingStatus={false}
      hasChanges={false} canSave={false} validation={{ canChangeRole: () => true, canDelete: () => true,
        getDeleteTooltip: () => "", getDeleteMessage: () => "", getRoleChangeMessage: () => "" }}
      onUpdate={jest.fn()} onSave={jest.fn()} onSaveInvite={jest.fn()} onRemove={jest.fn()}
      onResend={jest.fn()} onEnabledChange={jest.fn()} />
  </TeamLocationAccess></FormProvider>
}
const saveButton = () => screen.getByRole("button", { name: "Save location restrictions" })

describe("member location restriction editor", () => {
  beforeEach(() => {
    jest.mocked(fetch).mockReset()
    jest.mocked(useAuthContext).mockReturnValue({ user: { id: "account-one" }, isLoading: false } as ReturnType<typeof useAuthContext>)
  })

  it("renders actual searchable checkboxes inside the saved pending member card and retains inactive selections", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockResolvedValueOnce(saved())
    render(<CardHarness />)
    const checkbox = await screen.findByRole("checkbox", { name: "Branch A · inactive" })
    expect(checkbox).toBeChecked()
    expect(checkbox.closest("#team-member-0")).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    fireEvent.change(screen.getByRole("textbox", { name: "Search branches" }), { target: { value: "branch b" } })
    expect(screen.queryByRole("checkbox", { name: "Branch A · inactive" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    expect(await screen.findByText("Location restrictions saved.")).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith(`/api/site-members/${siteId}/location-restrictions`, expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ memberId, restricted_location_ids: [locationId, activeLocationId], expected_restricted_location_ids: [locationId] }),
    }))
    expect(saveButton()).toBeDisabled()
    expect(screen.queryByLabelText("Team location access")).not.toBeInTheDocument()
  })

  it("supports editing saved license-suspended pending members without activating them", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(payload))
    render(<CardHarness team={[{ ...members[0], license_suspended: true }]} />)
    expect(await screen.findByRole("checkbox", { name: "Branch A · inactive" })).toBeEnabled()
    expect(screen.getByText("Member status")).toBeInTheDocument()
  })

  it("retains unknown activity without calling the branch active or inactive", async () => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, locations: [{ ...payload.locations[0], is_active: null }] }))
    render(<Harness />)
    expect(await screen.findByRole("checkbox", { name: "Branch A · status unknown" })).toBeChecked()
  })

  it("clears only an explicit empty selection and explains additional-denial semantics", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockResolvedValueOnce(saved([]))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch A · inactive" }))
    expect(screen.getByText("No additional location restrictions")).toBeInTheDocument()
    expect(screen.getByText(/An empty list adds no location restrictions/)).toBeInTheDocument()
    fireEvent.click(saveButton())
    expect(await screen.findByText("Location restrictions saved.")).toBeInTheDocument()
    expect(fetch).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      body: JSON.stringify({ memberId, restricted_location_ids: [], expected_restricted_location_ids: [locationId] }),
    }))
  })

  it.each([false, undefined])("keeps editing closed for disabled or old missing SQL readiness %s", async editing_enabled => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, editing_enabled }))
    render(<Harness />)
    expect(await screen.findByText("Location restriction editing is not available yet.")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Branch A · inactive" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeDisabled()
    expect(saveButton()).toBeDisabled()
  })

  it.each(["admin", "owner", "effective-owner"])("disables exempt member %s", async role => {
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, members: [{ ...payload.members[0],
      role: role === "effective-owner" ? "collaborator" : role, is_location_exempt: true }] }))
    render(<Harness />)
    expect(await screen.findByText("Owners and admins are exempt from location restrictions.")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("does not fetch or enable editor for nonmanagers and unsaved invitations", async () => {
    const { rerender } = render(<Harness manager={false} />)
    expect(screen.getByText("Only team managers can edit location restrictions.")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    jest.mocked(fetch).mockResolvedValue(respond(payload))
    rerender(<Harness team={[{ ...members[0], id: undefined }]} />)
    expect(await screen.findByText("Save the invitation before setting location restrictions.")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("disables unsaved role changes and refreshes after the persisted role changes", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockResolvedValueOnce(respond({ ...payload,
      members: [{ ...payload.members[0], role: "marketing" }],
    }))
    const { rerender } = render(<Harness />)
    await screen.findByRole("checkbox", { name: "Branch B" })
    rerender(<Harness team={[{ ...members[0], role: "view" }]} />)
    expect(screen.getByText("Save the member's role before editing location restrictions.")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeDisabled()
    expect(fetch).toHaveBeenCalledTimes(1)
    rerender(<Harness team={[{ ...members[0], role: "view", originalRole: "marketing" }]} />)
    expect(await screen.findByRole("checkbox", { name: "Branch B" })).toBeEnabled()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("loads one configuration for all cards, not one request per member", async () => {
    const second = { ...members[0], id: otherSiteId }
    jest.mocked(fetch).mockResolvedValue(respond({ ...payload, members: [...payload.members, { ...payload.members[0], id: second.id }] }))
    render(<Harness team={[...members, second]} />)
    await waitFor(() => expect(screen.getAllByRole("checkbox", { name: "Branch B" })).toHaveLength(2))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("distinguishes missing schema, malformed readiness, foreign scope, and failed reads from empty lists", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond({ code: "LOCATION_ACCESS_SCHEMA_UNAVAILABLE" }, false))
      .mockResolvedValueOnce(respond({ ...payload, editing_enabled: "true" }))
      .mockResolvedValueOnce(respond({ ...payload, site_id: otherSiteId }))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(respond(payload))
    render(<Harness />)
    expect(await screen.findByText(/Location access setup is pending/)).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Refresh location access" }))
      expect(await screen.findByText("Location access could not be verified. Refresh before editing.")).toBeInTheDocument()
      expect(screen.queryByText("No additional location restrictions")).not.toBeInTheDocument()
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole("button", { name: "Refresh location access" }))
    expect(await screen.findByRole("checkbox", { name: "Branch B" })).toBeEnabled()
  })

  it.each([
    { body: { code: "LOCATION_ACCESS_NOT_READY" }, status: 409 },
    { body: { code: "LOCATION_RESTRICTIONS_REJECTED" }, status: 400 },
    { body: {}, status: 403 },
    { body: { success: true }, status: 200 },
    { body: { success: true, site_id: siteId, site_member_id: otherSiteId, restricted_location_ids: [], revision: 1 }, status: 200 },
  ])("preserves selection after rejected or malformed save %j and requires refresh", async ({ body, status }) => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockResolvedValueOnce(respond(body, status === 200, status))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Branch A · inactive" })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeChecked()
    expect(saveButton()).toBeDisabled()
    expect(screen.queryByText("Location restrictions saved.")).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("does not replay an ambiguous network save and reconciles on explicit refresh", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockRejectedValueOnce(new Error("Disconnected"))
      .mockResolvedValueOnce(respond({ ...payload, members: [{ ...payload.members[0], restricted_location_ids: [locationId, activeLocationId] }] }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("The save could not be confirmed")
    expect(fetch).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole("button", { name: "Refresh location access" }))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeEnabled())
    expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeChecked()
    expect(saveButton()).toBeDisabled()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it("retains drafts after bounded SQL concurrency failure and allows an explicit retry", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload))
      .mockResolvedValueOnce(respond({ code: "LOCATION_RESTRICTIONS_BUSY" }, false, 409)).mockResolvedValueOnce(saved())
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    expect(await screen.findByRole("alert")).toHaveTextContent("Membership is being updated")
    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())
    expect(await screen.findByText("Location restrictions saved.")).toBeInTheDocument()
  })

  it("does not resurrect an old draft when explicit refresh returns an unchanged saved selection", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(payload))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    expect(saveButton()).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Refresh location access" }))
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeEnabled())
    expect(screen.getByRole("checkbox", { name: "Branch B" })).not.toBeChecked()
    expect(saveButton()).toBeDisabled()
  })

  it("locks all location editors while a save is in flight and prevents duplicate submissions", async () => {
    let finish!: (value: Response) => void
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    const savingButton = screen.getByRole("button", { name: "Saving locations…" })
    expect(savingButton).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Branch A · inactive" })).toBeDisabled()
    fireEvent.click(savingButton)
    expect(fetch).toHaveBeenCalledTimes(2)
    await act(async () => { finish(saved()) })
    expect(await screen.findByText("Location restrictions saved.")).toBeInTheDocument()
  })

  it("bounds a stalled save without replaying it or claiming success", async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockImplementationOnce((_url, init) =>
      new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new Error("Aborted"))) }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    jest.useFakeTimers()
    try {
      fireEvent.click(saveButton())
      await act(async () => { jest.advanceTimersByTime(20_000) })
      expect(screen.getByRole("alert")).toHaveTextContent("The save could not be confirmed")
      expect(screen.getByRole("checkbox", { name: "Branch B" })).toBeChecked()
      expect(saveButton()).toBeDisabled()
      expect(fetch).toHaveBeenCalledTimes(2)
    } finally { jest.useRealTimers() }
  })

  it.each(["site", "account"])("ignores a late save after switching %s and never shows stale success", async change => {
    let finish!: (value: Response) => void
    jest.mocked(fetch).mockResolvedValueOnce(respond(payload)).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(respond({ ...payload, site_id: change === "site" ? otherSiteId : siteId,
        members: [{ ...payload.members[0], restricted_location_ids: [] }] }))
    const { rerender } = render(<Harness />)
    fireEvent.click(await screen.findByRole("checkbox", { name: "Branch B" }))
    fireEvent.click(saveButton())
    if (change === "account") jest.mocked(useAuthContext).mockReturnValue({ user: { id: "account-two" }, isLoading: false } as ReturnType<typeof useAuthContext>)
    rerender(<Harness site={change === "site" ? otherSiteId : siteId} />)
    await act(async () => { finish(saved()) })
    expect(await screen.findByText("No additional location restrictions")).toBeInTheDocument()
    expect(screen.queryByText("Location restrictions saved.")).not.toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Branch B" })).not.toBeChecked()
  })

  it("ignores old-site configuration while a new load is pending", async () => {
    let finish!: (value: Response) => void
    jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      .mockResolvedValueOnce(respond({ ...payload, site_id: otherSiteId, members: [] }))
    const { rerender } = render(<Harness />)
    rerender(<Harness site={otherSiteId} />)
    await act(async () => { finish(respond(payload)) })
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Restricted locations" })).getByText(/unavailable for this member/)).toBeInTheDocument()
  })
})