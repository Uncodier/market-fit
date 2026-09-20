export type ZavuPhoneCapability = "sms" | "voice" | "mms"
export type ZavuPhoneNumberType = "local" | "national" | "mobile" | "tollFree"

export type ZavuPhoneNumber = {
  id?: string
  phoneNumber: string
  name?: string
  friendlyName?: string
  locality?: string
  region?: string
  senderId?: string
  status?: string
  regulatoryStatus?: "approved" | "pending_review" | "rejected" | string
  capabilities?: ZavuPhoneCapability[] | Record<string, boolean>
  pricing?: {
    monthlyPrice?: number
    upfrontPrice?: number
    isFreeEligible?: boolean
  }
}

export type ZavuRegulatoryRequirement = {
  id?: string
  phoneNumberType?: ZavuPhoneNumberType
  requirementTypes?: Array<{
    id: string
    name?: string
    description?: string
    type?: "address" | "document" | "textual" | "action" | string
  }>
}

export type SitePhoneSettings = {
  site_id?: string
  channels?: unknown
}

type SitePhoneConnection = {
  status?: string
  connected_account?: {
    phoneNumber?: string
  }
  metadata?: {
    phone_number?: string
    phone_number_id?: string
    routing?: {
      phone_number?: string
      phone_number_id?: string
    }
  }
}

export function unwrapZavuItems<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items
  }
  return []
}

export function unwrapPurchasedPhoneNumber(data: unknown): ZavuPhoneNumber | undefined {
  if (!data || typeof data !== "object") return undefined
  const payload = data as { phoneNumber?: unknown }
  if (payload.phoneNumber && typeof payload.phoneNumber === "object") {
    return payload.phoneNumber as ZavuPhoneNumber
  }
  if (typeof payload.phoneNumber === "string") {
    return data as ZavuPhoneNumber
  }
  return undefined
}

export function formatPhoneCapabilities(
  capabilities: ZavuPhoneNumber["capabilities"]
): string[] {
  if (!capabilities) return []
  if (Array.isArray(capabilities)) return capabilities
  return Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability)
}

export function hasPhoneCapability(
  phoneNumber: ZavuPhoneNumber,
  capability: ZavuPhoneCapability
): boolean {
  return formatPhoneCapabilities(phoneNumber.capabilities).includes(capability)
}

export function canAssignPhoneNumber(
  phoneNumber: ZavuPhoneNumber,
  capability: ZavuPhoneCapability
): boolean {
  const hasRequiredCapability =
    !phoneNumber.capabilities || hasPhoneCapability(phoneNumber, capability)
  const hasUsableBillingStatus =
    !phoneNumber.status || phoneNumber.status === "active" || phoneNumber.status === "pending"
  return hasRequiredCapability && hasUsableBillingStatus && phoneNumber.regulatoryStatus !== "rejected"
}

function getSitePhoneConnections(channels: unknown): SitePhoneConnection[] {
  let parsed = channels
  if (typeof channels === "string") {
    try {
      parsed = JSON.parse(channels)
    } catch {
      return []
    }
  }
  if (!parsed || typeof parsed !== "object") return []
  const connections = (parsed as { connections?: unknown }).connections
  return Array.isArray(connections) ? connections : []
}

export function filterPhoneNumbersForSite(
  phoneNumbers: ZavuPhoneNumber[],
  settingsRows: SitePhoneSettings[],
  currentSiteId: string
): ZavuPhoneNumber[] {
  const assignedIds = new Set<string>()
  const assignedNumbers = new Set<string>()

  for (const row of settingsRows) {
    if (!row.site_id || row.site_id === currentSiteId) continue
    for (const connection of getSitePhoneConnections(row.channels)) {
      if (!["connected", "in_progress", "pending"].includes(connection.status || "")) continue
      const phoneNumberId =
        connection.metadata?.phone_number_id ||
        connection.metadata?.routing?.phone_number_id
      const phoneNumber =
        connection.metadata?.phone_number ||
        connection.metadata?.routing?.phone_number ||
        connection.connected_account?.phoneNumber
      if (phoneNumberId) assignedIds.add(phoneNumberId)
      if (phoneNumber) assignedNumbers.add(phoneNumber)
    }
  }

  return phoneNumbers.filter(
    (phoneNumber) =>
      (!phoneNumber.id || !assignedIds.has(phoneNumber.id)) &&
      !assignedNumbers.has(phoneNumber.phoneNumber)
  )
}

export function buildAvailablePhoneNumbersQuery(params: {
  countryCode: string
  type: ZavuPhoneNumberType
  contains?: string
  capabilities: ZavuPhoneCapability[]
  limit?: number
}): string {
  const query = new URLSearchParams({
    countryCode: params.countryCode,
    type: params.type,
    capabilities: params.capabilities.join(","),
    limit: String(params.limit ?? 10),
  })
  if (params.contains?.trim()) query.set("contains", params.contains.trim())
  return query.toString()
}

export function getRequirementSummary(requirements: ZavuRegulatoryRequirement[]): string[] {
  return requirements.flatMap((requirement) =>
    (requirement.requirementTypes || [])
      .filter((item) => item.type !== "action")
      .map((item) => item.name || item.description || item.type || "Additional information")
  )
}

export function getVoiceConnectionStatus(params: {
  agentEnabled?: unknown
  regulatoryStatus?: unknown
}): "connected" | "in_progress" | "pending" {
  if (params.agentEnabled === false) return "pending"
  return params.regulatoryStatus === "pending_review" ? "in_progress" : "connected"
}

export function getVoiceConnectionSuccessMessage(
  status: "connected" | "in_progress" | "pending"
): string {
  if (status === "pending") {
    return "Number reserved. Activate the Customer Support agent to enable Voice."
  }
  if (status === "in_progress") {
    return "Number connected. Voice will be available after activation requirements are complete."
  }
  return "Voice channel connected successfully and tools registered."
}

export function reconcilePhoneConnections(
  currentConnections: Record<string, any>[],
  index: number,
  payload: Record<string, any>
): Record<string, any>[] {
  if (Array.isArray(payload.connections)) {
    return payload.connections
  }

  const current = currentConnections[index] || {}
  const connection =
    payload.connection && typeof payload.connection === "object"
      ? payload.connection
      : {
          ...current,
          status: payload.status || "connected",
          zavu_sender_id: payload.senderId,
          connected_account: {
            ...(current.connected_account || {}),
            id: payload.senderId,
            channel: payload.channel,
            phoneNumber: payload.phoneNumber,
          },
          metadata: {
            ...(current.metadata || {}),
            phone_number: payload.phoneNumber,
            phone_number_id: payload.phoneNumberId,
            capabilities: payload.capabilities,
            regulatory_status: payload.regulatoryStatus,
            agent_enabled: payload.agentEnabled,
            activation_pending: payload.activationPending,
            zavu_agent_id: payload.zavuAgentId,
            routing: {
              channel: payload.channel,
              sender_id: payload.senderId,
              phone_number_id: payload.phoneNumberId,
              phone_number: payload.phoneNumber,
            },
          },
        }

  const nextConnections = [...currentConnections]
  nextConnections[index] = connection
  return nextConnections
}

export function createPhoneConnectionMetadata(params: {
  channel: "sms" | "voice"
  selected: ZavuPhoneNumber
  responseData?: Record<string, unknown>
  purchased?: ZavuPhoneNumber
}) {
  const number = params.purchased || params.selected
  const response = params.responseData || {}
  return {
    ...response,
    senderId:
      (typeof response.senderId === "string" && response.senderId) ||
      (typeof response.id === "string" && response.id) ||
      number.senderId,
    phoneNumber: number.phoneNumber,
    phoneNumberId: number.id,
    channel: params.channel,
    capabilities: formatPhoneCapabilities(number.capabilities),
    regulatoryStatus: number.regulatoryStatus,
  }
}
