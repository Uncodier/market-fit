import { isActiveAgentChannel, isManuallyDisabledAgentChannel } from "@/lib/agent-channel-state"
import {
  canConnectAgentChannel, countAgentChannels, countConnectedAccounts, getRequiredAddons,
  isActiveAgentChannel as billingIsActiveAgentChannel,
} from "@/lib/billing-limits"
import type { Site } from "@/app/context/site-types"

describe("shared agent channel state", () => {
  it("keeps the billing export compatible", () => {
    expect(billingIsActiveAgentChannel).toBe(isActiveAgentChannel)
  })

  it.each(["whatsapp", "messenger", "sms", "email", "telegram", "instagram", "voice", "custom-chat_v2"])("accepts connected %s unless effectively disabled", type => {
    const connection = { type, status: "connected" }
    expect(isActiveAgentChannel(connection)).toBe(true)
    expect(isActiveAgentChannel({ ...connection, enabled: true, license_suspended: false, _license: { manually_disabled: false } })).toBe(true)
    for (const flags of [{ enabled: false }, { license_suspended: true }, { _license: { manually_disabled: true } },
      { status: "disabled", enabled: false, license_suspended: false, _license: { manually_disabled: true } }]) {
      expect(isActiveAgentChannel({ ...connection, ...flags })).toBe(false)
    }
  })

  it.each(["active", "synced"])("permits historical %s only for Voice", status => {
    expect(isActiveAgentChannel({ type: "voice", status })).toBe(true)
    expect(isActiveAgentChannel({ type: "email", status })).toBe(false)
    expect(isActiveAgentChannel({ type: "voice", status, enabled: false })).toBe(false)
    expect(isActiveAgentChannel({ type: "voice", status, license_suspended: true })).toBe(false)
    expect(isActiveAgentChannel({ type: "voice", status, _license: { manually_disabled: true } })).toBe(false)
  })

  it.each([undefined, null, [], "connected", {}, { status: "pending" }, { status: "disconnected" }, { status: "disabled" }])("rejects missing or inactive state %p", state => {
    expect(isActiveAgentChannel(state)).toBe(false)
  })

  it("recognizes only the canonical explicit manual marker, independently of quota state", () => {
    expect(isManuallyDisabledAgentChannel({ _license: { manually_disabled: true } })).toBe(true)
    for (const state of [null, { enabled: false }, { status: "disabled" }, { license_suspended: true },
      { manually_disabled: true }, { _license: { manually_disabled: "true" } }, { _license: { manually_disabled: false } }]) {
      expect(isManuallyDisabledAgentChannel(state)).toBe(false)
    }
  })

  it("uses the same effective count for billing usage, add-ons and admission", () => {
    const site = { billing: { plan: "engine", addons_count: 0 }, settings: { channels: { connections: [
      { type: "voice", status: "synced" },
      { type: "whatsapp", status: "connected", enabled: false },
      { type: "email", status: "connected", license_suspended: true },
      { type: "sms", status: "connected", _license: { manually_disabled: true } },
      { type: "telegram", status: "active" },
    ] } } } as unknown as Site
    expect(countAgentChannels(site)).toBe(1)
    expect(countConnectedAccounts(site)).toBe(1)
    expect(getRequiredAddons(site)).toBe(0)
    expect(canConnectAgentChannel(site)).toBe(false)
    site.billing!.addons_count = 1
    expect(canConnectAgentChannel(site)).toBe(true)
    site.settings!.channels!.connections!.shift()
    site.billing!.addons_count = 0
    expect(canConnectAgentChannel(site)).toBe(true)
    expect(countAgentChannels(null)).toBe(0)
  })
})