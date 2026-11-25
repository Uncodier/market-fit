import { z } from 'zod'
import { exactToolIdPattern } from '@/app/connectors/connector-request'

const uuid = z.string().uuid()
export const graphDigest = z.string().regex(/^[a-f0-9]{64}$/)
export const toolId = z.string().regex(exactToolIdPattern)
const pin = { toolkit_slug: z.string().regex(/^[a-z0-9_][a-z0-9_-]{0,99}$/),
  toolkit_version: z.string().regex(/^20\d{6}_\d{2}$/), schema_hash: graphDigest }
export const taskConnectorDescriptor = z.object({ ...pin, connector_id: uuid, tool_slug: toolId, input_schema: z.record(z.unknown()) })
export type TaskConnectorDescriptor = z.infer<typeof taskConnectorDescriptor>
export const taskConnectorReview = z.object({ ...pin,
  instance_id: uuid, node_id: uuid, connector_id: uuid, trigger_id: uuid, principal_id: uuid,
  operation: toolId, arguments: z.record(z.unknown()), cron: z.string().min(1).max(256), timezone: z.string().min(1).max(128),
  digest: graphDigest, published: z.boolean(),
})
export type TaskConnectorReview = z.infer<typeof taskConnectorReview>
export const taskConnectorResult = z.object({ executed: z.literal(true), report: z.object({
  title: z.string().max(200), note: z.string().max(512), columns: z.tuple([z.literal('Field'), z.literal('Value')]),
  rows: z.array(z.tuple([z.string().max(200), z.string().max(200)])).max(100),
}) })
export type TaskConnectorResult = z.infer<typeof taskConnectorResult>
export const taskConnectorRevocation = z.object({ published: z.literal(false), revoked: z.literal(true), connector_id: uuid })
