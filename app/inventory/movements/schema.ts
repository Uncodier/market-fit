import { z } from "zod"

const uuid = z.string().uuid()
const quantity = z.number().finite().positive().max(1_000_000_000)
const notes = z.string().trim().max(1000).optional()
export const transferSchema = z.object({
  kind: z.literal("transfer"), catalogItemId: uuid,
  fromLocationId: uuid, toLocationId: uuid, quantity, notes, receivingUserId: uuid.optional(),
}).strict()
const adjustmentSchema = z.object({
  kind: z.literal("adjustment"), catalogItemId: uuid, toLocationId: uuid,
  quantity: z.number().finite().min(-1_000_000_000).max(1_000_000_000).refine(value => value !== 0), notes,
}).strict()
const receiptSchema = z.object({
  kind: z.literal("receipt"), purchaseId: uuid, toLocationId: uuid,
}).strict()
export const batchSchema = z.object({
  siteId: uuid, requestId: uuid,
  operations: z.array(z.discriminatedUnion("kind", [transferSchema, adjustmentSchema, receiptSchema])).min(1).max(100),
}).strict().superRefine((input, context) => {
  input.operations.forEach((operation, index) => {
    if (operation.kind === "transfer" && operation.fromLocationId.toLowerCase() === operation.toLocationId.toLowerCase()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["operations", index], message: "Choose two distinct locations" })
    }
  })
})
export type InventoryBatch = z.infer<typeof batchSchema>
const singleMovementSchema = transferSchema.omit({ kind: true }).extend({ siteId: uuid, requestId: uuid }).strict()
const multiMovementSchema = z.object({
  siteId: uuid, requestId: uuid, fromLocationId: uuid, toLocationId: uuid, notes,
  receivingUserId: uuid.optional(),
  items: z.array(z.object({ catalogItemId: uuid, quantity }).strict()).min(1).max(100),
}).strict()
export const createMovementSchema = z.union([singleMovementSchema, multiMovementSchema])