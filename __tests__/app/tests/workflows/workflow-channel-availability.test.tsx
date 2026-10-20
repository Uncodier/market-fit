import { fireEvent, render, screen } from "@testing-library/react"
import { WorkflowChannelMessageFields } from "@/app/components/workflows/workflow-channel-message-fields"
import { WorkflowSearchSelect } from "@/app/components/workflows/workflow-search-select"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import type { SiteChannelSource } from "@/lib/site-channels"

let mockSite: SiteChannelSource | null
const mockPhoneNumbers = jest.fn<Record<string, string>, [unknown]>(() => ({}))

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock("@/app/components/settings/use-zavu-sender-phone-numbers", () => ({
  useZavuSenderPhoneNumbers: (options: unknown) => mockPhoneNumbers(options),
  getSenderPhoneNumberKey: () => "sender",
}))
jest.mock("@/app/components/ui/relation-select", () => ({
  RelationSelect: ({ options, value, onValueChange, disabled, placeholder }: {
    options: { id: string; label: string }[]; value: RelationSelectValue;
    onValueChange: (value: RelationSelectValue) => void; disabled?: boolean; placeholder: string
  }) => <div>
    <span data-testid={`${placeholder}-value`}>{value?.label}</span>
    <select aria-label={placeholder} disabled={disabled} value={value?.mode === "existing" ? value.id : ""}
      onChange={event => onValueChange({ mode: "existing", id: event.target.value, label: event.target.value })}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </div>,
}))

describe("workflow channel availability", () => {
  beforeEach(() => { mockSite = null; mockPhoneNumbers.mockClear() })

  it("offers neither all channels nor a disabled saved connection when none is available", () => {
    mockSite = { settings: { channels: { connections: [{ id: "disabled", type: "whatsapp", status: "connected", _license: { manually_disabled: true } }] } } }
    render(<WorkflowChannelMessageFields trigger={{ kind: "channel_message", channel: "whatsapp", connection_id: "disabled" }} onPersist={jest.fn()} />)
    expect(screen.getAllByRole("option").map(option => (option as HTMLOptionElement).value)).toEqual(["any", "any"])
    expect(screen.getByTestId("Channel-value")).toHaveTextContent("whatsapp")
    expect(screen.getByTestId("Connection-value")).toHaveTextContent("disabled")
    expect(screen.getByLabelText("Connection")).toBeDisabled()
    expect(mockPhoneNumbers).toHaveBeenCalledWith({ connections: [], enabled: true })
  })

  it("uses only active Voice accounts and retains unavailable saved IDs without fallback", () => {
    mockSite = { settings: { channels: { connections: [
      { id: "voice-active", type: "voice", status: "active" },
      { id: "voice-synced", type: "voice", status: "synced" },
      { id: "manual", type: "voice", status: "connected", _license: { manually_disabled: true } },
      { id: "quota", type: "voice", status: "connected", license_suspended: true },
      { id: "disabled", type: "voice", status: "connected", enabled: false },
      { id: "email-active", type: "email", status: "active" },
    ] } } }
    const onPersist = jest.fn().mockResolvedValue(undefined)
    render(<WorkflowChannelMessageFields trigger={{ kind: "channel_message", channel: "voice", connection_id: "manual" }} onPersist={onPersist} />)
    expect(screen.getAllByRole("option").map(option => (option as HTMLOptionElement).value)).toEqual(["any", "voice", "any", "voice-active", "voice-synced"])
    expect(onPersist).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Connection"), { target: { value: "voice-active" } })
    expect(onPersist).toHaveBeenCalledWith({ trigger: { kind: "channel_message", channel: "voice", connection_id: "voice-active" } })
  })

  it("preserves current-option compatibility for other workflow selectors", () => {
    render(<WorkflowSearchSelect options={[{ value: "existing", label: "Existing" }]} value="saved" onChange={jest.fn()} />)
    expect(screen.getAllByRole("option").map(option => (option as HTMLOptionElement).value)).toEqual(["existing", "saved"])
  })
})