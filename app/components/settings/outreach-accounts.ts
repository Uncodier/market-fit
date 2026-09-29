import { isOutreachChannel, type OutreachAccount } from "@/lib/outreach-settings"
import { getChannelLabel } from "@/lib/site-channels"

const connected = (value: unknown) => typeof value === "string" && ["active", "connected", "synced"].includes(value)
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0
const legacyIds = new Set(["email", "agent_email", "whatsapp", "agent_whatsapp"])
const usableId = (value: unknown): value is string => text(value) && value === value.trim()
  && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value) && !legacyIds.has(value)

export const getOutreachChannelLabel = (channel: string) => channel === "voice" ? "Voice calls" : getChannelLabel(channel)

/** Offer only exact, unambiguous sending accounts; never synthesize a sender or fall back. */
export function getUsableOutreachAccounts(channels: any): OutreachAccount[] {
  if (!channels || typeof channels !== "object") return []
  const accounts: OutreachAccount[] = []
  const connections = Array.isArray(channels.connections) ? channels.connections : []
  const idCounts = new Map<string, number>()
  for (const connection of connections) {
    if (text(connection?.id)) idCounts.set(connection.id, (idCounts.get(connection.id) || 0) + 1)
  }
  for (const connection of connections) {
    if (!connection || connection.enabled === false || !isOutreachChannel(connection.type) || connection.status !== "connected") continue
    if (connection.type === "email" && connection.metadata?.emailChannelActive === false) continue
    if (!usableId(connection.id) || idCounts.get(connection.id) !== 1 || !text(connection.zavu_sender_id)) continue
    const identity = connection.connected_account?.email || connection.metadata?.from_address || connection.connected_account?.phone_number || connection.metadata?.phone_number
    const name = connection.name || connection.metadata?.from_name || `${getOutreachChannelLabel(connection.type)} account`
    accounts.push({ id: connection.id, channel: connection.type, label: text(identity) ? `${name} · ${identity}` : connection.name || `${name} (${connection.id.slice(0, 8)})` })
  }
  if (channels.email?.enabled !== false && connected(channels.email?.status) && text(channels.email.email)) {
    accounts.push({ id: "email", channel: "email", label: `Direct email · ${channels.email.email}` })
  }
  const agentEmail = { ...channels.agent_email?.data, ...channels.agent_email }
  const domain = agentEmail?.domain === "custom" ? agentEmail.customDomain : agentEmail?.domain
  const inboxAddress = [agentEmail?.email, agentEmail?.inbox_id, agentEmail?.id].find(value => text(value) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
  if (agentEmail?.enabled !== false && connected(agentEmail?.status) && (inboxAddress || (text(agentEmail.username) && text(domain)))) {
    const address = inboxAddress || `${agentEmail.username}@${domain}`
    accounts.push({ id: "agent_email", channel: "email", label: `Agent email · ${address}` })
  }
  const whatsapp = channels.whatsapp
  if (whatsapp?.enabled !== false && connected(whatsapp?.status) && text(whatsapp.account_sid) && (text(whatsapp.from_number) || text(whatsapp.existingNumber) || text(whatsapp.messaging_service_sid))) {
    accounts.push({ id: "whatsapp", channel: "whatsapp", label: `Direct WhatsApp · ${whatsapp.from_number || whatsapp.existingNumber || "Messaging service"}` })
  }
  const agentWhatsapp = channels.agent_whatsapp
  if (agentWhatsapp?.enabled !== false && connected(agentWhatsapp?.status) && text(agentWhatsapp.account_sid) && text(agentWhatsapp.access_token) && (text(agentWhatsapp.from_number) || text(agentWhatsapp.existingNumber) || text(agentWhatsapp.messaging_service_sid))) {
    accounts.push({ id: "agent_whatsapp", channel: "whatsapp", label: "Agent WhatsApp · Configured account" })
  }
  return accounts.filter((account, index) => accounts.findIndex(other => other.id === account.id && other.channel === account.channel) === index)
}