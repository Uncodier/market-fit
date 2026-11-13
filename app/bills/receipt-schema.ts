import { z } from "zod"

export const billInventoryReceiptSchema = z.object({
  siteId: z.string().uuid(), requestId: z.string().uuid(), purchaseId: z.string().uuid(),
  toLocationId: z.string().uuid(), receivingUserId: z.string().uuid(),
  lines: z.array(z.object({
    purchaseItemId: z.string().uuid(), quantity: z.number().finite().positive().max(1_000_000_000),
  }).strict()).min(1).max(100),
}).strict().superRefine((input, ctx) => {
  if (new Set(input.lines.map(line => line.purchaseItemId.toLowerCase())).size !== input.lines.length) {
    ctx.addIssue({ code: "custom", message: "Duplicate bill line", path: ["lines"] })
  }
})

export type BillInventoryReceiptInput = z.infer<typeof billInventoryReceiptSchema>
export type BillInventoryReceiptLine = {
  id: string; name: string; quantity: number; received_quantity: number; catalog_item_id: string
}