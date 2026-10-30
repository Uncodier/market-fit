import { z } from 'zod'

const uuid = z.string().uuid().transform(value => value.toLowerCase())
const entries = (length: number) => z.record(z.string().min(1).max(100), z.string().max(length))
  .refine(value => Object.keys(value).length <= 200, 'Too many draft entries')

export const draftSchema = z.object({
  reference: z.string().max(200), prices: entries(40), evidence: entries(100),
  key: z.string().min(1).max(100), attempted: z.boolean(),
  registeredSupplier: z.string().max(100).nullable(), proposalRevision: z.string().max(100),
  holderName: z.string().max(200),
}).strict()
export type Draft = z.infer<typeof draftSchema>

export const draftSelectorSchema = z.object({
  publication_id: uuid, version: z.number().int().positive().max(2147483647),
  applicant_key: z.union([z.literal('personal'), z.string().regex(/^(business|supplier):[0-9a-fA-F-]{36}$/)
    .refine(value => uuid.safeParse(value.split(':')[1]).success).transform(value => value.toLowerCase())]),
}).strict()
export type DraftSelector = z.infer<typeof draftSelectorSchema>
export const draftRevisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const draftPutSchema = draftSelectorSchema.extend({
  expected_revision: draftRevisionSchema.nullable(), draft: draftSchema,
}).strict()
export const draftDeleteSchema = draftSelectorSchema.extend({ expected_revision: draftRevisionSchema }).strict()
export type DraftResponse = { draft: Draft | null; draft_revision: number | null }