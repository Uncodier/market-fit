import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { ActivitiesSection } from "@/app/components/settings/ActivitiesSection"
import { mergeActivitySettings, normalizeActivitySettings } from "@/app/components/settings/activity-settings"
import { fetchOutreachSegments } from "@/app/components/settings/outreach-segments"
import type { SiteFormValues } from "@/app/components/settings/form-schema"

const emailId = "11111111-1111-4111-8111-111111111111"
const secondEmailId = "22222222-2222-4222-8222-222222222222"
const whatsappId = "33333333-3333-4333-8333-333333333333"
let mockCurrentSite: any
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockCurrentSite }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "AI Activities" }) }))
jest.mock("@/app/components/navigation/NavigationLink", () => ({ NavigationLink: ({ children }: any) => <span>{children}</span> }))
jest.mock("@/app/components/settings/outreach-segments", () => ({ fetchOutreachSegments: jest.fn() }))
jest.mock("@/app/components/settings/icp-mining-lists", () => ({ fetchIcpMiningLists: jest.fn().mockResolvedValue([]) }))

function TestForm({ onSave, initial }: { onSave: jest.Mock; initial?: any }) {
  const form = useForm<SiteFormValues>({ defaultValues: {
    activities: normalizeActivitySettings(initial), business_hours: [{ timezone: "America/New_York" } as any],
  } })
  return <FormProvider {...form}><ActivitiesSection active siteId={mockCurrentSite.id} onSave={onSave} /></FormProvider>
}

const card = (key = "leads_follow_up") => within(document.getElementById(`activity-${key}`)!)

describe("ActivitiesSection outreach controls", () => {
  beforeEach(() => {
    mockCurrentSite = { id: "site-a", settings: { channels: { connections: [
      { id: emailId, type: "email", status: "connected", name: "Sales email", zavu_sender_id: "sender-1" },
      { id: secondEmailId, type: "email", status: "connected", name: "Support email", zavu_sender_id: "sender-2" },
      { id: whatsappId, type: "whatsapp", status: "connected", name: "Sales WhatsApp", zavu_sender_id: "sender-3" },
      { id: "sms-id", type: "sms", status: "connected", name: "Sales SMS", zavu_sender_id: "sender-sms" },
      { id: "telegram-id", type: "telegram", status: "connected", name: "Sales Telegram", zavu_sender_id: "sender-telegram" },
      { id: "voice-id", type: "voice", status: "connected", name: "Sales Voice", zavu_sender_id: "sender-voice" },
      { id: "custom-id", type: "custom-chat_v2", status: "connected", name: "Custom agent", zavu_sender_id: "sender-custom" },
      { id: "missing-sender", type: "unsupported", status: "connected", name: "Hidden unsupported" },
      { id: "offline-telegram", type: "telegram", status: "disconnected", name: "Hidden Telegram", zavu_sender_id: "sender-offline" },
      { id: "audio-id", type: "audio", status: "connected", name: "Hidden audio", zavu_sender_id: "sender-audio" },
    ] } } }
    jest.mocked(fetchOutreachSegments).mockResolvedValue([{ id: "segment-a", name: "Enterprise" }, { id: "segment-b", name: "Local" }])
  })

  it("starts inactive and blocks enabling without explicit targeting/accounts", async () => {
    const onSave = jest.fn()
    render(<TestForm onSave={onSave} />)
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    expect(card().getByRole("radio", { name: /Inactive/ })).toBeChecked()
    for (const name of ["Hidden unsupported", "Hidden Telegram", "Hidden audio"]) expect(screen.queryByText(name)).not.toBeInTheDocument()
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByRole("radio", { name: /Inactive/ })).toBeChecked()
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one connected")
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one segment")
    expect(onSave).not.toHaveBeenCalled()
  })

  it("shows the persisted site timezone for both fixed-time controls rather than unsaved form hours", async () => {
    mockCurrentSite.settings.business_hours = [{ timezone: "Europe/Madrid" }]
    render(<TestForm onSave={jest.fn()} />)
    for (const key of ["daily_resume_and_stand_up", "leads_follow_up"]) {
      expect(card(key).getByText(/Schedule timezone: Europe\/Madrid/)).toBeInTheDocument()
      expect(card(key).queryByText(/Schedule timezone: America\/New_York/)).not.toBeInTheDocument()
    }
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
  })

  it("multi-selects per channel, targets site segments, saves cap and Sunday with no fallback", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} />)
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    for (const name of ["Sales email", "Support email", "Sales WhatsApp", "Enterprise", "Local", "Sunday"]) fireEvent.click(card().getByRole("checkbox", { name }))
    for (const name of ["Tuesday", "Wednesday", "Thursday"]) fireEvent.click(card().getByRole("checkbox", { name }))
    fireEvent.change(card().getByRole("spinbutton", { name: "Daily message limit" }), { target: { value: "90" } })
    fireEvent.change(card().getByRole("spinbutton", { name: "Maximum unanswered messages" }), { target: { value: "7" } })
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByText(/Schedule timezone: America\/New_York/)).toBeInTheDocument()
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(mergeActivitySettings(undefined, onSave.mock.calls[0][0].activities).leads_follow_up).toEqual({
      status: "active", channel_accounts: { email: [emailId, secondEmailId], whatsapp: [whatsappId] },
      segment_ids: ["segment-a", "segment-b"], all_segments: false, daily_message_limit: 90, max_unanswered_messages: 7, weekdays: [0],
    })
    await waitFor(() => expect(card().getByRole("button", { name: "Save" })).toBeDisabled())
  })

  it("allows explicit all-segments targeting but rejects empty weekdays and invalid caps", async () => {
    render(<TestForm onSave={jest.fn()} />)
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    fireEvent.click(card().getByRole("checkbox", { name: "Sales email" }))
    fireEvent.click(card().getByRole("checkbox", { name: /All segments/ }))
    for (const name of ["Tuesday", "Wednesday", "Thursday"]) fireEvent.click(card().getByRole("checkbox", { name }))
    fireEvent.change(card().getByRole("spinbutton", { name: "Daily message limit" }), { target: { value: "1.5" } })
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByRole("alert")).toHaveTextContent("whole number")
    expect(card().getByRole("alert")).toHaveTextContent("weekday")
    expect(card().getByRole("alert")).not.toHaveTextContent("Select at least one segment")
  })

  it.each(["leads_initial_cold_outreach", "leads_follow_up"] as const)("selects all connected channel types without email/WhatsApp and reloads %s", async key => {
    const onSave = jest.fn().mockResolvedValue(true)
    const { unmount } = render(<TestForm onSave={onSave} />)
    await waitFor(() => expect(card(key).getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    for (const label of ["SMS accounts", "Telegram accounts", "Voice calls accounts", "Custom-chat_v2 accounts"]) expect(card(key).getByRole("group", { name: label })).toBeInTheDocument()
    expect(card(key).getByText(/Voice calls require the contact's explicit consent/)).toBeInTheDocument()
    expect(card(key).getByText(/Audio is a message format supported by applicable messaging channels/)).toBeInTheDocument()
    expect(card(key).queryByRole("group", { name: /Audio accounts/ })).not.toBeInTheDocument()
    for (const name of ["Sales SMS", "Sales Telegram", "Sales Voice", "Custom agent", "Enterprise"]) fireEvent.click(card(key).getByRole("checkbox", { name }))
    fireEvent.change(card(key).getByRole("spinbutton", { name: "Daily message limit" }), { target: { value: "72" } })
    fireEvent.change(card(key).getByRole("spinbutton", { name: "Maximum unanswered messages" }), { target: { value: "6" } })
    fireEvent.click(card(key).getByRole("radio", { name: /^Active/ }))
    expect(card(key).getByRole("radio", { name: /^Active/ })).toBeChecked()
    fireEvent.click(card(key).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const saved = mergeActivitySettings(undefined, onSave.mock.calls[0][0].activities)
    expect(saved[key]).toEqual({
      status: "active", channel_accounts: { email: [], whatsapp: [], sms: ["sms-id"], telegram: ["telegram-id"], voice: ["voice-id"], "custom-chat_v2": ["custom-id"] },
      segment_ids: ["segment-a"], all_segments: false, daily_message_limit: 72, max_unanswered_messages: 6, weekdays: [2, 3, 4],
    })
    unmount()
    render(<TestForm onSave={onSave} initial={saved} />)
    await waitFor(() => expect(card(key).getByRole("checkbox", { name: "Enterprise" })).toBeChecked())
    for (const name of ["Sales SMS", "Sales Telegram", "Sales Voice", "Custom agent"]) expect(card(key).getByRole("checkbox", { name })).toBeChecked()
    for (const name of ["Sales email", "Support email", "Sales WhatsApp"]) expect(card(key).getByRole("checkbox", { name })).not.toBeChecked()
    expect(card(key).getByRole("spinbutton", { name: "Daily message limit" })).toHaveValue(72)
    expect(card(key).getByRole("spinbutton", { name: "Maximum unanswered messages" })).toHaveValue(6)
  })

  it("shows saved disconnected channel groups, blocks their activation and allows removal without fallback", async () => {
    const onSave = jest.fn().mockResolvedValue(true)
    render(<TestForm onSave={onSave} initial={{ leads_follow_up: { channel_accounts: { telegram: ["offline-telegram"], "old-custom": ["old-id"] }, all_segments: true } }} />)
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    const oldGroup = within(card().getByRole("group", { name: "Old-custom accounts" }))
    expect(oldGroup.getByText(/Previously selected account is unavailable \(old-id\)/)).toBeInTheDocument()
    fireEvent.click(card().getByRole("radio", { name: /^Active/ }))
    expect(card().getByRole("radio", { name: /Inactive/ })).toBeChecked()
    expect(card().getByRole("alert")).toHaveTextContent("Select at least one connected, usable channel account")
    fireEvent.click(oldGroup.getByRole("button", { name: "Remove" }))
    fireEvent.click(within(card().getByRole("group", { name: "Telegram accounts" })).getByRole("button", { name: "Remove" }))
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].activities.leads_follow_up.channel_accounts).toEqual({ email: [], whatsapp: [], telegram: [], "old-custom": [] })
  })

  it("does not mark failed saves clean and shows unavailable selected accounts", async () => {
    const onSave = jest.fn().mockResolvedValue(false)
    render(<TestForm onSave={onSave} initial={{ leads_follow_up: { channel_accounts: { email: ["missing-id"], whatsapp: [] } } }} />)
    await waitFor(() => expect(card().getByRole("checkbox", { name: "Enterprise" })).toBeInTheDocument())
    expect(card().getByText(/Previously selected account is unavailable/)).toBeInTheDocument()
    fireEvent.change(card().getByRole("spinbutton", { name: "Daily message limit" }), { target: { value: "45" } })
    fireEvent.click(card().getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(card().getByRole("button", { name: "Save" })).toBeEnabled()
    expect(card("leads_initial_cold_outreach").queryByText("Follow-up weekdays")).not.toBeInTheDocument()
  })
})