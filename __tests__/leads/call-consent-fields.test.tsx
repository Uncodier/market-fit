import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState, type ReactNode } from "react"
import { SWRConfig } from "swr"
import { CallConsentFields } from "@/app/leads/components/CallConsentFields"
import { DetailsTab } from "@/app/leads/components/DetailsTab"
import { updateLeadCallConsent } from "@/app/leads/call-consent-actions"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { useLeadData } from "@/app/hooks/useLeadData"
import { getVoiceCallBlock } from "@/lib/chat/voice-call-eligibility"
import type { Lead } from "@/app/leads/types"

jest.mock("@/app/leads/call-consent-actions", () => ({ updateLeadCallConsent: jest.fn() }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: "22222222-2222-4222-8222-222222222222" } }),
}))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/commerce/resolve-relation", () => ({ resolveRelationId: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/services/user-service", () => ({ getUserData: jest.fn() }))
const maybeSingle = jest.fn()
const query = { select: jest.fn(), eq: jest.fn(), maybeSingle }
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => query }) }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (value: string) => void; disabled?: boolean; children: ReactNode }) => (
    <select aria-label="Outbound-call consent" value={value} disabled={disabled} onChange={(event) => onValueChange(event.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}))

const siteId = "22222222-2222-4222-8222-222222222222"
const at = "2026-01-01T10:00:00.000Z"
const lead: Lead = {
  id: "11111111-1111-4111-8111-111111111111", name: "Test lead", email: "test@example.com",
  personal_email: null, phone: "+12025550123", company_id: null, company: null, position: null,
  segment_id: null, campaign_id: null, status: "new", created_at: at, updated_at: at,
  last_contact: null, origin: null, birthday: null, language: null, social_networks: null,
  address: null, notes: null, voice_call_consent_status: "unknown", voice_call_consent_at: null,
  do_not_call: false,
}
const onSaved = jest.fn()
const originalResizeObserver = globalThis.ResizeObserver

beforeAll(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})
afterAll(() => { globalThis.ResizeObserver = originalResizeObserver })

beforeEach(() => {
  jest.clearAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  jest.mocked(useOptionalPermissions).mockReturnValue({
    siteId, capabilities: { role: "collaborator", is_owner: false, select: true, insert: true, update: true, delete: false },
    can: () => true, isViewOnly: false,
  })
  jest.mocked(updateLeadCallConsent).mockResolvedValue({ lead: {
    id: lead.id, voice_call_consent_status: "granted", voice_call_consent_at: at,
    do_not_call: false, updated_at: "2026-01-02T10:00:00.000Z",
  } })
})

function mount(override: Partial<Lead> = {}) {
  return render(<SWRConfig value={{ provider: () => new Map() }}>
    <CallConsentFields lead={{ ...lead, ...override }} siteId={siteId} onSaved={onSaved} />
  </SWRConfig>)
}

function open() {
  fireEvent.click(screen.getByRole("button", { name: "Edit call consent" }))
}

function chooseGrant() {
  fireEvent.change(screen.getByRole("combobox", { name: "Outbound-call consent" }), { target: { value: "granted" } })
  fireEvent.change(screen.getByLabelText("Consent obtained at (your local time)"), { target: { value: "2026-01-01T10:00:00" } })
}

function confirmAndSave() {
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("button", { name: "Save call consent" }))
}

it("shows unknown consent but explains the missing phone rather than requiring consent", () => {
  mount({ phone: null })
  expect(screen.getByText("Unknown")).toBeInTheDocument()
  expect(screen.getByText("Not recorded")).toBeInTheDocument()
  expect(screen.getByText(/Add a valid international phone number/)).toBeInTheDocument()
  expect(updateLeadCallConsent).not.toHaveBeenCalled()
})

it.each(["Edit consent status", "Edit consent date", "Edit do not call"])(
  "opens the editor from the displayed value: %s", (label) => {
    mount({ phone: null })
    fireEvent.click(screen.getByRole("button", { name: label }))
    expect(screen.getByRole("dialog", { name: "Edit call consent" })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toHaveValue("unknown")
    expect(screen.getByRole("button", { name: "Save call consent" })).toBeDisabled()
    expect(updateLeadCallConsent).not.toHaveBeenCalled()
  }
)

it.each([false, true])("places editable consent last in Info with showEmpty=%s", async (showEmpty) => {
  const onUpdateLead = jest.fn()
  render(<SWRConfig value={{ provider: () => new Map() }}>
    <DetailsTab lead={{ ...lead, phone: null, position: "Director", origin: "Website" }}
      segments={[]} campaigns={[]} showEmpty={showEmpty} onToggleEmpty={jest.fn()}
      onUpdateLead={onUpdateLead} onCallConsentSaved={onSaved} />
  </SWRConfig>)

  const consent = screen.getByRole("region", { name: "Outbound call consent" })
  expect(consent.parentElement?.lastElementChild).toBe(consent)
  expect(screen.getByText("Origin").compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const emptyToggle = screen.getByRole("button", { name: /^(Show \d+ empty fields|Hide empty fields)$/ })
  expect(emptyToggle.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  if (showEmpty) expect(screen.getByText("Phone")).toBeInTheDocument()
  else expect(screen.queryByText("Phone")).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Edit consent status" }))
  chooseGrant()
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ voice_call_consent_status: "granted" })))
  expect(updateLeadCallConsent).toHaveBeenCalledWith(expect.objectContaining({ expected: expect.objectContaining({ phone: null }) }))
  expect(onUpdateLead).not.toHaveBeenCalled()
})

it.each([
  ["unknown", null, false, "valid phone number and no explicit call opt-out"],
  ["granted", at, false, "valid phone number and no explicit call opt-out"],
  ["granted", "invalid", false, "valid phone number and no explicit call opt-out"],
  ["revoked", null, false, "explicitly opted out"],
  ["granted", at, true, "do-not-call list"],
] as const)("displays current %s consent and do-not-call precedence", (status, date, doNotCall, message) => {
  mount({ voice_call_consent_status: status, voice_call_consent_at: date, do_not_call: doNotCall })
  expect(screen.getByText(new RegExp(message))).toBeInTheDocument()
})

it.each(["read-only", "loading", "other-site", "no-provider"])("does not allow editing with %s permissions", (mode) => {
  const permissions = jest.mocked(useOptionalPermissions)()
  jest.mocked(useOptionalPermissions).mockReturnValue(mode === "no-provider" ? null : {
    ...permissions!,
    siteId: mode === "other-site" ? "other-site" : siteId,
    capabilities: mode === "loading" ? null : permissions!.capabilities,
    can: () => mode !== "read-only",
  })
  mount()
  expect(screen.getByRole("button", { name: "Edit call consent" })).toBeDisabled()
  for (const label of ["Edit consent status", "Edit consent date", "Edit do not call"]) {
    const button = screen.getByRole("button", { name: label })
    expect(button).toBeDisabled()
    fireEvent.click(button)
  }
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(updateLeadCallConsent).not.toHaveBeenCalled()
})

it("fails closed when consent fields were not loaded", () => {
  mount({ voice_call_consent_status: undefined })
  expect(screen.getByRole("button", { name: "Edit call consent" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Edit consent status" })).toBeDisabled()
  expect(screen.getByText(/Reload the lead to load/)).toBeInTheDocument()
})

it("requires confirmation and a real date; never auto-grants when opening or cancelling", () => {
  mount()
  open()
  expect(screen.getByRole("combobox")).toHaveValue("unknown")
  expect(screen.getByRole("button", { name: "Save call consent" })).toBeDisabled()
  expect(screen.getByText(/does not request consent or start a call/)).toBeInTheDocument()
  expect(screen.getByText(/Unknown consent does not block calls/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "granted" } })
  expect(screen.getByLabelText("Consent obtained at (your local time)")).toHaveValue("")
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(updateLeadCallConsent).not.toHaveBeenCalled()
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("submits explicit consent in UTC, preserves the snapshot, and returns saved server state", async () => {
  mount()
  open()
  chooseGrant()
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(updateLeadCallConsent).toHaveBeenCalledWith({
    id: lead.id, site_id: siteId, confirmed: true,
    voice_call_consent_status: "granted",
    voice_call_consent_at: new Date("2026-01-01T10:00:00").toISOString(),
    do_not_call: false,
    expected: { voice_call_consent_status: "unknown", voice_call_consent_at: null, do_not_call: false, phone: lead.phone, updated_at: at },
  })
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ updated_at: "2026-01-02T10:00:00.000Z" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("revokes consent and clears its timestamp", async () => {
  mount({ voice_call_consent_status: "granted", voice_call_consent_at: at })
  open()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "revoked" } })
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(updateLeadCallConsent).toHaveBeenCalledWith(expect.objectContaining({ voice_call_consent_status: "revoked", voice_call_consent_at: null }))
})

it("does not grant consent when do-not-call is turned off and requires reconfirmation after a change", async () => {
  mount({ do_not_call: true })
  open()
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(screen.getByRole("switch", { name: "Do not call" }))
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(updateLeadCallConsent).toHaveBeenCalledWith(expect.objectContaining({ voice_call_consent_status: "unknown", voice_call_consent_at: null, do_not_call: false }))
})

it("preserves the exact grant instant when only changing do-not-call", async () => {
  const original = "2026-01-01T10:00:00.123456+00:00"
  mount({ voice_call_consent_status: "granted", voice_call_consent_at: original })
  open()
  fireEvent.click(screen.getByRole("switch", { name: "Do not call" }))
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(updateLeadCallConsent).toHaveBeenCalledWith(expect.objectContaining({
    voice_call_consent_at: original, do_not_call: true,
  }))
})

it("keeps the original comparison snapshot if fresher lead data arrives while editing", async () => {
  const view = mount()
  open()
  chooseGrant()
  view.rerender(<SWRConfig value={{ provider: () => new Map() }}>
    <CallConsentFields lead={{ ...lead, do_not_call: true }} siteId={siteId} onSaved={onSaved} />
  </SWRConfig>)
  confirmAndSave()
  await waitFor(() => expect(onSaved).toHaveBeenCalled())
  expect(updateLeadCallConsent).toHaveBeenCalledWith(expect.objectContaining({
    expected: expect.objectContaining({ do_not_call: false }),
  }))
})

it("rejects future consent dates without a write", async () => {
  mount()
  open()
  chooseGrant()
  fireEvent.change(screen.getByLabelText("Consent obtained at (your local time)"), { target: { value: "2999-01-01T10:00:00" } })
  confirmAndSave()
  expect(await screen.findByRole("alert")).toHaveTextContent("non-future")
  expect(updateLeadCallConsent).not.toHaveBeenCalled()
})

it("preserves the draft on rejection and never claims success", async () => {
  jest.mocked(updateLeadCallConsent).mockResolvedValue({ error: "The lead changed. Reload it." })
  mount()
  open()
  chooseGrant()
  confirmAndSave()
  expect(await screen.findByRole("alert")).toHaveTextContent("The lead changed")
  expect(screen.getByRole("combobox")).toHaveValue("granted")
  expect(screen.getByLabelText("Consent obtained at (your local time)")).toHaveValue("2026-01-01T10:00")
  expect(onSaved).not.toHaveBeenCalled()
  expect(updateLeadCallConsent).toHaveBeenCalledTimes(1)
})

it("keeps an ambiguous save visible without retrying", async () => {
  jest.mocked(updateLeadCallConsent).mockRejectedValue(new Error("network disconnected"))
  mount()
  open()
  chooseGrant()
  confirmAndSave()
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload the lead")
  expect(onSaved).not.toHaveBeenCalled()
  expect(updateLeadCallConsent).toHaveBeenCalledTimes(1)
})

it("prevents duplicate submissions and dismissal while saving", async () => {
  let resolve!: (value: { error: string }) => void
  jest.mocked(updateLeadCallConsent).mockReturnValue(new Promise((done) => { resolve = done }))
  mount()
  open()
  chooseGrant()
  confirmAndSave()
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
  expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
  fireEvent.submit(screen.getByRole("button", { name: "Saving…" }).closest("form")!)
  expect(updateLeadCallConsent).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ error: "Reload the lead" }))
})

it.each(["grant", "revoke", "do-not-call"] as const)("refreshes mounted Conversations eligibility after %s", async (change) => {
  const initialLead: Lead = change === "grant" ? { ...lead, voice_call_consent_status: "revoked" }
    : { ...lead, voice_call_consent_status: "granted", voice_call_consent_at: at }
  let storedLead = { ...initialLead, site_id: siteId }
  maybeSingle.mockImplementation(async () => ({ data: { channel: "voice", lead_id: lead.id, leads: storedLead }, error: null }))
  jest.mocked(updateLeadCallConsent).mockImplementation(async () => {
    const saved = {
      id: lead.id, voice_call_consent_status: change === "revoke" ? "revoked" as const : "granted" as const,
      voice_call_consent_at: change === "revoke" ? null : at, do_not_call: change === "do-not-call", updated_at: at,
    }
    storedLead = { ...storedLead, ...saved }
    return { lead: saved }
  })
  function Harness() {
    const [current, setCurrent] = useState(initialLead)
    const { leadData, isConversationReady } = useLeadData("conversation-voice", siteId)
    return <>
      <output>{isConversationReady && !getVoiceCallBlock(leadData) ? "Call eligible" : "Call blocked"}</output>
      <CallConsentFields lead={current} siteId={siteId} onSaved={(saved) => setCurrent((previous) => ({ ...previous, ...saved }))} />
    </>
  }
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}><Harness /></SWRConfig>)
  await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1))
  expect(await screen.findByText(change === "grant" ? "Call blocked" : "Call eligible")).toBeInTheDocument()
  open()
  if (change === "grant") chooseGrant()
  if (change === "revoke") fireEvent.change(screen.getByRole("combobox"), { target: { value: "revoked" } })
  if (change === "do-not-call") fireEvent.click(screen.getByRole("switch", { name: "Do not call" }))
  confirmAndSave()
  expect(await screen.findByText(change === "grant" ? "Call eligible" : "Call blocked")).toBeInTheDocument()
  expect(screen.getByText(change === "revoke" ? "Revoked" : "Granted")).toBeInTheDocument()
  await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(2))
})