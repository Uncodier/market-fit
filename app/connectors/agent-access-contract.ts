import { z } from "zod"

export const connectorAccountSchema = z.object({
  id: z.string().uuid(),
  toolkit_slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,99}$/),
  display_name: z.string(),
  revision: z.number().int().positive(),
})

export const agentConnectorDirectorySchema = z.object({
  active: z.boolean(),
  assigned: z.array(connectorAccountSchema.extend({ available: z.boolean() })),
  available: z.array(connectorAccountSchema),
})

export type AgentConnectorDirectory = z.infer<typeof agentConnectorDirectorySchema>

export function agentGrantIsCurrent(grant: { enabled: boolean; revoked_at?: string | null; expires_at: string | null }, now: number) {
  return grant.enabled && !grant.revoked_at && (grant.expires_at === null || Date.parse(grant.expires_at) > now)
}

export function agentConnectorGrantReceipt(id: string, revision: number) {
  return z.object({ connector_id: z.literal(id), revision: z.literal(revision + 1) })
}