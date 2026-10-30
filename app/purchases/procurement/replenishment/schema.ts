import { z } from 'zod'

export const replenishmentDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  catalog_item_id: z.string().uuid(), location_id: z.string().uuid(),
  minimum: z.number().finite().nonnegative().max(1000000),
  target: z.number().finite().positive().max(1000000),
  minimum_order: z.number().int().min(1).max(1000000),
  order_multiple: z.number().int().min(1).max(1000000),
  action: z.enum(['alert', 'draft']), enabled: z.boolean(),
}).strict().refine(value => value.target > value.minimum, { path: ['target'], message: 'Target must exceed the minimum' })
export const saveReplenishmentSchema = z.object({
  id: z.string().uuid().nullable(), expected_version: z.number().int().nonnegative(), document: replenishmentDocumentSchema,
}).strict()
export type ReplenishmentDocument = z.infer<typeof replenishmentDocumentSchema>
export type ReplenishmentRule = ReplenishmentDocument & { id: string; version: number }

export const replenishmentPageSize = 50
const pageSchema = z.string().regex(/^[1-9]\d{0,5}$/).transform(Number).default('1')
export const replenishmentListSchema = z.object({ page: pageSchema, case_page: pageSchema }).strict()