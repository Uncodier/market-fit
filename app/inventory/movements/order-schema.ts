import { z } from "zod"

const uuid = z.string().uuid()
const quantity = z.number().finite().positive().max(1_000_000_000)
const notes = z.string().trim().max(1000).optional()
export const transferOrderSchema = z.object({
  siteId: uuid, requestId: uuid, fromLocationId: uuid, toLocationId: uuid,
  receivingUserId: uuid.optional(), notes, status: z.enum(["draft", "requested"]),
  items: z.array(z.object({ catalogItemId: uuid, quantity }).strict()).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (value.fromLocationId.toLowerCase() === value.toLocationId.toLowerCase()) context.addIssue({ code: z.ZodIssueCode.custom, message: "Choose different locations" })
  if (new Set(value.items.map(item => item.catalogItemId.toLowerCase())).size !== value.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each product must appear once" })
  }
})
export const transferTransitionSchema = z.object({
  siteId: uuid, orderId: uuid, requestId: uuid,
  action: z.enum(["request", "approve", "cancel", "dispatch", "receive", "reconcile"]),
  revision: z.number().int().nonnegative(), notes,
  lines: z.array(z.object({
    lineId: uuid, quantity: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    returnedQuantity: z.number().finite().nonnegative().max(1_000_000_000).optional(),
    writtenOffQuantity: z.number().finite().nonnegative().max(1_000_000_000).optional(), notes,
  }).strict()).min(1).max(100).optional(),
}).strict().superRefine((input, context) => {
  const requiresLines = ["dispatch", "receive", "reconcile"].includes(input.action)
  if (requiresLines !== !!input.lines) context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid action lines" })
  if (input.lines && new Set(input.lines.map(line => line.lineId.toLowerCase())).size !== input.lines.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate transfer lines" })
  }
  for (const line of input.lines || []) {
    if (input.action !== "reconcile" && (line.quantity === undefined || line.returnedQuantity !== undefined || line.writtenOffQuantity !== undefined)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid dispatch or receipt quantity" })
    }
    if (input.action === "receive" && (line.quantity || 0) <= 0) context.addIssue({ code: z.ZodIssueCode.custom, message: "Receipt quantity must be positive" })
    if (input.action === "reconcile" && (line.quantity !== undefined ||
      (line.returnedQuantity || 0) + (line.writtenOffQuantity || 0) <= 0 || !(line.notes || input.notes)?.trim())) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Reconciliation requires quantities and a reason" })
    }
  }
  if (input.action === "dispatch" && !input.lines?.some(line => (line.quantity || 0) > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Dispatch at least one product" })
  }
})
export type CreateTransferOrderInput = z.infer<typeof transferOrderSchema>
export type TransferTransitionInput = z.infer<typeof transferTransitionSchema>