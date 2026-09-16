import type { ChannelSetupStep } from "./ChannelSetupStepper"

export function buildEmailSetupSteps(params: {
  domainVerified: boolean
  inboundEnabled: boolean
  channelActive: boolean
}): ChannelSetupStep[] {
  return [
    {
      label: "DNS Verification",
      status: params.domainVerified ? "complete" : "current",
    },
    {
      label: "Inbound",
      status: params.inboundEnabled
        ? "complete"
        : params.domainVerified
          ? "current"
          : "upcoming",
    },
    {
      label: "Activation",
      status: params.channelActive
        ? "complete"
        : params.inboundEnabled
          ? "current"
          : "upcoming",
    },
  ]
}

export function buildPhoneSetupSteps(channel: {
  status?: string
  metadata?: {
    phone_number?: string
    phone_number_id?: string
    regulatory_status?: string
  }
}): ChannelSetupStep[] {
  const hasNumber = Boolean(
    channel.metadata?.phone_number_id || channel.metadata?.phone_number
  )
  const regulatoryStatus = channel.metadata?.regulatory_status
  const isConnected = channel.status === "connected"
  const isRejected = regulatoryStatus === "rejected"
  const complianceComplete = isConnected || regulatoryStatus === "approved"

  return [
    {
      label: "Phone Number",
      status: hasNumber ? "complete" : "current",
    },
    {
      label: "Compliance",
      status: isRejected
        ? "error"
        : complianceComplete
          ? "complete"
          : hasNumber
            ? "current"
            : "upcoming",
    },
    {
      label: "Activation",
      status: isConnected
        ? "complete"
        : channel.status === "failed" && !isRejected
          ? "error"
          : complianceComplete
            ? "current"
            : "upcoming",
    },
  ]
}
