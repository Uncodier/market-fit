import { createPhoneConnectionMetadata, type ZavuPhoneNumber } from "./zavu-phone-number-utils"

export function normalizeSmsSetupResponse({ selected, purchased, responseData }: {
  selected: ZavuPhoneNumber
  purchased?: ZavuPhoneNumber
  responseData?: Record<string, unknown>
}) {
  const data = responseData || {}
  const payload = { ...createPhoneConnectionMetadata({ channel: "sms", selected, purchased }), ...data }
  const status = typeof data.status === "string" ? data.status : "pending"
  const regulatoryBlocked = typeof data.regulatoryStatus === "string" &&
    data.regulatoryStatus !== "approved"
  const connected = status === "connected" && data.activationPending === false && !regulatoryBlocked
  return {
    ...payload,
    status: connected ? "connected" : status === "connected" ? "in_progress" : status,
    activationPending: !connected,
  }
}