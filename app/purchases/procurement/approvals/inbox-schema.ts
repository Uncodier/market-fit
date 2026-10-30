import { z } from 'zod'

export const approvalStages = {
  requisition: 'Requisition', publication: 'Tender publication', award: 'Award', order: 'Purchase order',
} as const
export const inboxRowSchema = z.object({
  id: z.string(), target_id: z.string().uuid(), stage: z.enum(['requisition', 'publication', 'award', 'order']),
  title: z.string(), status: z.enum(['pending', 'approved', 'rejected', 'returned']),
  revision: z.number().int(), date: z.string(),
  is_deprecated: z.boolean().optional(),
})
export const inboxResponseSchema = z.object({ rows: z.array(inboxRowSchema), count: z.number().int().nonnegative() })
export type InboxRow = z.infer<typeof inboxRowSchema>