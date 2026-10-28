import { z } from 'zod'
import { timestampSchema } from '@/app/purchases/procurement/domain/config'

export const tenderLineSchema = z.object({
  id: z.string().uuid(), description: z.string().trim().min(1).max(2000),
  quantity: z.number().int().min(1).max(1000000), unit: z.string().trim().min(1).max(40),
  unit_net_minor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  catalog_item_id: z.string().uuid().nullable().default(null),
}).strict()
export const tenderDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().trim().max(10000),
  request_id: z.string().uuid().nullable(), currency: z.enum(['USD', 'MXN', 'EUR', 'GBP', 'CAD']),
  visibility: z.enum(['public', 'unlisted', 'private']), global_visible: z.boolean(),
  participation: z.enum(['open', 'invitation_only', 'approved_suppliers']), opening_policy: z.enum(['on_receipt', 'after_close']),
  participation_deadline: timestampSchema, opening_at: timestampSchema,
  requirements: z.array(tenderLineSchema).min(1).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.global_visible && value.visibility !== 'public') ctx.addIssue({ code: 'custom', message: 'Global discovery requires public visibility', path: ['global_visible'] })
  if (value.opening_policy === 'after_close' && Date.parse(value.opening_at) < Date.parse(value.participation_deadline)) ctx.addIssue({ code: 'custom', message: 'Opening must follow participation closing', path: ['opening_at'] })
  const total = value.requirements.reduce((sum, line) => sum + line.quantity * line.unit_net_minor, 0)
  if (!Number.isSafeInteger(total)) ctx.addIssue({ code: 'custom', message: 'Estimate exceeds supported range', path: ['requirements'] })
  if (new Set(value.requirements.map(line => line.id)).size !== value.requirements.length) ctx.addIssue({ code: 'custom', message: 'Duplicate requirement IDs', path: ['requirements'] })
})
export const saveTenderSchema = z.object({ expected_version: z.number().int().min(0), document: tenderDocumentSchema }).strict()
export const tenderActionSchema = z.object({ expected_version: z.number().int().positive(), action: z.enum(['close', 'cancel', 'delete']) }).strict()
export type TenderDocument = z.infer<typeof tenderDocumentSchema>
export type Tender = TenderDocument & { id: string; site_id: string; version: number; status: 'draft' | 'published' | 'closed' | 'cancelled'; portal_slug: string; net_amount_minor: number; created_by: string; updated_at: string }
export type TenderPublication = { id: string; version: number; published_at: string; snapshot: PublicTender }
export type PublicTender = { title: string; description: string; currency: string; participation: string; opening_policy: string; participation_deadline: string; opening_at: string; requirements: { id: string; description: string; quantity: number; unit: string }[] }