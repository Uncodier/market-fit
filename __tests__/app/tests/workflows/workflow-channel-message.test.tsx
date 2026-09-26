import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { WorkflowTriggerBody } from "@/app/components/workflows/workflow-trigger-body"
import type { WorkflowTriggerConfig } from "@/app/components/workflows/types"
import { NODE_W, TRIGGER_KIND_OPTIONS } from "@/app/components/workflows/types"
import { apiClient } from "@/app/services/api-client-service"

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({
    currentSite: {
      settings: {
        channels: {
          connections: [
            { id: "email-1", type: "email", name: "Sales inbox", status: "connected" },
            { id: "email-2", type: "email", name: "Support inbox", status: "connected" },
            { id: "wa-1", type: "whatsapp", name: "Main phone", status: "connected" },
            { id: "sms-1", type: "sms", status: "disconnected" },
          ],
        },
      },
    },
  }),
}))

jest.mock("@/app/components/workflows/workflow-cron-fields", () => ({
  WorkflowCronFields: () => null,
}))

jest.mock("@/app/components/settings/use-zavu-sender-phone-numbers", () => ({
  useZavuSenderPhoneNumbers: () => ({}),
}))

jest.mock("@/app/components/workflows/workflow-search-select", () => ({
  WorkflowSearchSelect: ({ options, value, onChange, placeholder, disabled }: {
    options: { value: string; label: string }[]
    value: string
    onChange: (value: string) => void
    placeholder: string
    disabled?: boolean
  }) => (
    <select aria-label={placeholder} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  ),
}))

const node = {
  id: "trigger-1",
  instance_id: "instance-1",
  site_id: "site-1",
} as InstanceNode

function show(trigger: WorkflowTriggerConfig = { kind: "channel_message" }, hasExecutableStep = true, hasUnsupportedChannelStep = false) {
  const onPersist = jest.fn().mockResolvedValue(undefined)
  render(
    <WorkflowTriggerBody
      node={node}
      trigger={trigger}
      enabled={false}
      hasExecutableStep={hasExecutableStep}
      hasUnsupportedChannelStep={hasUnsupportedChannelStep}
      onKindsChange={jest.fn()}
      onPersist={onPersist}
    />,
  )
  return onPersist
}

describe("channel-message workflow trigger", () => {
  afterEach(() => jest.restoreAllMocks())

  it("saves channel and priority without a standalone webhook URL", () => {
    const onPersist = show()
    const triggerKinds = TRIGGER_KIND_OPTIONS.map(({ label }) => screen.getByRole("button", { name: label }))
    expect(triggerKinds).toHaveLength(5)
    expect(triggerKinds[0].parentElement).toHaveClass("flex", "items-center")
    expect(triggerKinds[0].parentElement).not.toHaveClass("flex-wrap")
    expect(NODE_W).toBeGreaterThanOrEqual(600)
    expect(screen.queryByText(/POST .*\/api\/workflows\/triggers\/dispatch/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox", { name: "Channel" }), { target: { value: "email" } })
    expect(onPersist).toHaveBeenCalledWith({ trigger: { kind: "channel_message", channel: "email" } })
    expect(screen.getByRole("combobox", { name: "Connection" })).toBeDisabled()
    expect(screen.getByText(/requires exactly one connected account/)).toBeInTheDocument()
    const input = screen.getByRole("spinbutton", { name: "Priority (0–100)" })
    fireEvent.change(input, { target: { value: "90" } })
    fireEvent.blur(input)
    expect(onPersist).toHaveBeenCalledWith({ trigger: { kind: "channel_message", priority: 90 } })
    fireEvent.change(input, { target: { value: "101" } })
    fireEvent.blur(input)
    expect(input).toHaveValue(50)
  })

  it("lets a uniquely connected channel select its connection", () => {
    const onPersist = show({ kind: "channel_message", channel: "whatsapp" })
    const connection = screen.getByRole("combobox", { name: "Connection" })
    expect(connection).not.toBeDisabled()
    expect(screen.getByRole("option", { name: "WhatsApp · wa-1" })).toBeInTheDocument()
    fireEvent.change(connection, { target: { value: "wa-1" } })
    expect(onPersist).toHaveBeenCalledWith({
      trigger: { kind: "channel_message", channel: "whatsapp", connection_id: "wa-1" },
    })
  })

  it("clears an old connection filter when the channel becomes ambiguous", () => {
    const onPersist = show({ kind: "channel_message", channel: "email", connection_id: "email-2" })
    expect(screen.getByRole("combobox", { name: "Connection" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Use any connection" }))
    expect(onPersist).toHaveBeenCalledWith({
      trigger: { kind: "channel_message", channel: "email", connection_id: undefined },
    })
  })

  it("allows clearing a disconnected connection even when none are available", () => {
    const onPersist = show({ kind: "channel_message", channel: "sms", connection_id: "sms-1" })
    expect(screen.getByRole("combobox", { name: "Connection" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Use any connection" }))
    expect(onPersist).toHaveBeenCalledWith({
      trigger: { kind: "channel_message", channel: "sms", connection_id: undefined },
    })
  })

  it("requires a step before activation or test", () => {
    show({ kind: "channel_message" }, false)
    expect(screen.getByRole("alert")).toHaveTextContent("Add a workflow step")
    expect(screen.getByRole("switch")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled()
  })

  it("disables activation and test if the branch requires sandbox or browser", () => {
    show({ kind: "channel_message" }, true, true)
    expect(screen.getByRole("alert")).toHaveTextContent("cannot run sandbox or browser steps")
    expect(screen.getByRole("switch")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Test" })).toBeDisabled()
  })

  it("tests using a sample message without sending to a customer channel", async () => {
    const post = jest.spyOn(apiClient, "post").mockResolvedValue({ success: true })
    show({ kind: "channel_message", channel: "email", connection_id: "email-2", priority: 90 })
    fireEvent.change(screen.getByRole("textbox", { name: "Sample customer message (test only)" }), {
      target: { value: "Where is my order?" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Test" }))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/workflows/instance-1/sync-triggers", {}))
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/workflows/instance-1/test", {
      payload: {
        source: "channel_message",
        trigger_id: "trigger-1",
        test: true,
        channel: "email",
        connection_id: "email-2",
        message: "Where is my order?",
      },
    }))
    expect(post.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[1])
  })
})