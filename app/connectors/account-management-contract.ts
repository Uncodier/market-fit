import { z } from "zod"

export const connectionName = z.string().trim().min(1).max(200)
  .regex(/^[^\p{Cc}]+$/u)

export const accountManagementUpdate = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("rename"), display_name: connectionName }).strict(),
  z.object({ operation: z.enum(["remove_members", "remove_agents"]) }).strict(),
])

export type AccountManagementUpdate = z.infer<typeof accountManagementUpdate>

export function accountManagementReceipt(id: string, revision: number, update: AccountManagementUpdate) {
  return z.object({ connector_id: z.literal(id), revision: z.literal(revision + 1),
    operation: z.literal(update.operation), display_name: update.operation === "rename" ? z.literal(update.display_name) : z.null(),
  })
}