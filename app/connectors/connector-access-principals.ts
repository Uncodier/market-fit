import type { AgentGrant, ConnectorAccess, MemberGrant } from "./types"

export type PrincipalKind = "member" | "agent"

export function accessPrincipals(access: ConnectorAccess, kind: PrincipalKind) {
  const options = kind === "member" ? access.member_options : access.agent_options
  const rows = new Map<string, MemberGrant | AgentGrant>()
  if (kind === "member") access.members.forEach(row => rows.set(row.user_id, row))
  else access.agents.forEach(row => rows.set(row.agent_id, row))
  const eligibleIds = new Set(options.map(option => option.id))
  const eligible = options.map(option => ({ ...option, eligible: true, row: rows.get(option.id) }))
  const retained = [...rows].filter(([id]) => !eligibleIds.has(id))
    .map(([id, row]) => ({ id, label: id, eligible: false, row }))
  return [...eligible, ...retained]
}

export function isExpired(expiresAt: string | null, now: number) {
  return expiresAt !== null && new Date(expiresAt).getTime() <= now
}

export function exceptionStatus(row: MemberGrant | AgentGrant, now: number) {
  if (row.revoked_at) return "connectors.overrideBlocked"
  if (isExpired(row.expires_at, now)) return "connectors.overrideExpired"
  if ("enabled" in row ? row.enabled : row.can_use) return "connectors.overrideAllowed"
  if ("can_view" in row && row.can_view) return "connectors.overrideViewOnly"
  return "connectors.overrideBlocked"
}