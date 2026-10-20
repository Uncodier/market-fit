/** Shared effective state for persisted agent connections, not provider readiness alone. */
export type AgentChannelState = {
  type?: string | null
  status?: string | null
  enabled?: boolean
  license_suspended?: boolean
  _license?: { manually_disabled?: unknown; [key: string]: unknown } | null
}

function channelState(channel: unknown): AgentChannelState | undefined {
  return channel && typeof channel === "object" && !Array.isArray(channel)
    ? channel as AgentChannelState : undefined
}

/** Manual disablement is explicit and must never be inferred from quota suspension. */
export function isManuallyDisabledAgentChannel(channel: unknown): boolean {
  return channelState(channel)?._license?.manually_disabled === true
}

/** Voice retains active/synced compatibility; every disabled state takes precedence. */
export function isActiveAgentChannel(channel: unknown): boolean {
  const state = channelState(channel)
  if (!state || state.enabled === false || state.license_suspended === true
    || isManuallyDisabledAgentChannel(state)) return false
  return state.status === "connected" || (state.type === "voice"
    && (state.status === "active" || state.status === "synced"))
}