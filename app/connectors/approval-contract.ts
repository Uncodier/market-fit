import { z } from "zod"

const uuid = z.string().uuid()
export const approvalRequestSchema = z.object({
  id: uuid, connector_id: uuid, agent_id: uuid, conversation_id: uuid.nullable(),
  review_conversation_id: uuid.nullish(),
  tool_slug: z.string(), version: z.string(), account_label: z.string(), agent_label: z.string().optional(),
  arguments: z.record(z.unknown()), expires_at: z.string().datetime({ offset: true }),
  created_at: z.string().datetime({ offset: true }).optional(),
  context: z.object({
    agent_label: z.string().max(100), conversation_title: z.string().max(100).nullable(),
    instance_id: uuid.nullable(), instance_label: z.string().max(100).nullable(), source_excerpt: z.string().max(180).nullable(),
  }).optional(),
})
export const approvalInboxSchema = z.object({ items: z.array(approvalRequestSchema) })
export function approvalReceipt(id: string, decision: "approve" | "reject") {
  return z.object({ id: z.literal(id), status: z.literal(decision === "approve" ? "completed" : "rejected"),
    result: z.unknown().optional(), result_omitted: z.boolean().optional() }).transform(receipt => ({
    id: receipt.id, status: receipt.status, ...(decision === "approve" && receipt.result !== undefined ? { result: receipt.result } : {}),
    ...(decision === "approve" && receipt.result_omitted ? { result_omitted: true } : {}),
  }))
}