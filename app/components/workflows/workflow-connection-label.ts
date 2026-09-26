import { formatPhoneNumber, getAssignedPhoneNumber } from "@/app/components/settings/zavu-phone-number-utils"
import { getChannelLabel, normalizeChannel } from "@/lib/site-channels"

type WorkflowConnection = {
  id?: string | null
  type?: string | null
  zavu_sender_id?: string | null
  metadata?: unknown
  connected_account?: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function firstText(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim()
}

export function getWorkflowConnectionLabel(connection: WorkflowConnection, fetchedPhoneNumber?: string): string {
  const type = normalizeChannel(connection.type)
  const metadata = asRecord(connection.metadata)
  const account = asRecord(connection.connected_account)
  let identifier: string | undefined

  if (type === "whatsapp" || type === "sms" || type === "voice") {
    const phoneNumber = getAssignedPhoneNumber(connection) || fetchedPhoneNumber
    if (phoneNumber) identifier = formatPhoneNumber(phoneNumber)
  } else if (type === "email") {
    identifier = firstText(metadata.from_address, metadata.email_address, account.emailAddress, account.email)
  } else if (type === "telegram") {
    const username = firstText(metadata.bot_username, account.username)
    identifier = username ? `@${username.replace(/^@/, "")}` : firstText(metadata.bot_id)
  }

  const accountName = firstText(account.name)
  identifier ||= firstText(
    metadata.account_username,
    metadata.page_name,
    metadata.page_id,
    metadata.account_id,
    account.username,
    accountName?.toLowerCase() === getChannelLabel(type).toLowerCase() ? undefined : accountName,
    account.id,
  )

  if (!identifier || identifier.toLowerCase() === getChannelLabel(type).toLowerCase()) {
    identifier = firstText(connection.id, connection.zavu_sender_id) || "Unknown connection"
  }

  return `${getChannelLabel(type)} · ${identifier}`
}