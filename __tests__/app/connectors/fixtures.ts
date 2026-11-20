import messages from "@/app/context/locales/connectors/en.json"
import type { Catalog, Connector, ConnectorAccess, ConnectorDetail, Toolkit } from "@/app/connectors/types"

export function translate(key: string, params: Record<string, string | number> = {}) {
  const pagination: Record<string, string> = { "commerce.pagination.next": "Next", "commerce.pagination.previous": "Previous", "commerce.pagination.more": "More pages" }
  const value = (messages as Record<string, string>)[key] || pagination[key] || key
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => String(params[name] ?? match))
}
export const toolkit: Toolkit = {
  slug: "mail", name: "Mail toolkit", description: "Workspace email", logo: null,
  domains: ["messaging"], skills: ["makinari-email"], tools_count: 12,
  auth_schemes: ["OAUTH2"], connection_count: 1,
}
export const connector: Connector = {
  id: "connector-1", toolkit_slug: "mail", display_name: "Sales mailbox", provider_status: "ACTIVE",
  enabled: false, revocation_pending: false, revision: 4, verified_at: "2026-11-01T12:00:00Z", can_use: false,
}
export const catalog: Catalog = {
  items: [toolkit], domains: [{ id: "messaging", label: "Messaging", skill_slugs: ["makinari-email"] }],
  next_cursor: "next-cursor", can_manage: true, configured: true, total: null,
}
export const detail: ConnectorDetail = {
  toolkit, connections: [connector], auth_configs: [{ id: "auth-1", name: "Mail OAuth", auth_scheme: "OAUTH2" }], can_manage: true,
}
export const access: ConnectorAccess = {
  connector_id: connector.id, revision: 4, members: [{ user_id: "member-1", can_view: true, can_use: false, expires_at: null }],
  agents: [], policy: { allowed_tools: [], allowed_hosts: ["assistant"], require_approval: true },
  member_options: [{ id: "member-1", label: "Member One" }], agent_options: [{ id: "agent-1", label: "Agent One" }], can_manage: true,
}
export function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}