import { z } from 'zod'

export const requestLineSchema = z.object({
  catalog_item_id: z.string().uuid().nullable(),
  description: z.string().trim().max(500).default(''),
  quantity: z.number().int().min(1).max(1000000),
  unit_estimate_minor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  tax_ids: z.array(z.string().uuid()).max(20).optional(),
}).strict().superRefine((line, ctx) => {
  if (!line.catalog_item_id && !line.description.length) ctx.addIssue({ code: 'custom', message: 'Describe the service or select a catalog item' })
  if (line.catalog_item_id && (line.unit_estimate_minor !== undefined || line.tax_ids !== undefined)) ctx.addIssue({ code: 'custom', message: 'Catalog prices and taxes cannot be overridden' })
  if (line.unit_estimate_minor !== undefined && line.tax_ids === undefined) ctx.addIssue({ code: 'custom', message: 'Explicit tax selection is required for service estimates' })
})
export const requestDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200), description: z.string().max(5000).default(''),
  currency: z.enum(['USD', 'MXN', 'EUR', 'GBP', 'CAD']),
  lines: z.array(requestLineSchema).min(1).max(100),
}).strict()
export const saveRequestSchema = z.object({
  expected_revision: z.number().int().min(0).max(2147483646), document: requestDocumentSchema,
}).strict()
export const submitRequestSchema = z.object({ expected_revision: z.number().int().positive() }).strict()
export const requestDecisionSchema = z.object({
  expected_revision: z.number().int().positive(), stage_id: z.string().uuid(),
  decision: z.enum(['approve', 'reject']), reason: z.string().trim().min(1).max(2000),
}).strict()
export type RequestDocument = z.infer<typeof requestDocumentSchema>
export type RequestSummary = {
  id: string; title: string; description: string; currency: RequestDocument['currency'];
  net_amount_minor: number; revision: number; requester_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'returned';
  updated_at: string; policy_revision: number | null;
  tenders?: { id: string; title: string; status: 'draft' | 'published' | 'closed' | 'cancelled' }[];
}
export type RequestItem = {
  id: string; revision: number; position: number; catalog_item_id: string | null; category_ids: string[];
  description: string; quantity: number; unit_net_minor: number | null; net_amount_minor: number | null;
  valuation_source: 'catalog_cost' | 'manager_estimate' | 'unpriced';
  tax_snapshot: Array<{ id: string; name: string; rate: number }> | null;
}
