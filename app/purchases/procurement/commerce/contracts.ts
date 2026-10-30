import { z } from "zod"

const uuid = z.string().uuid()
// Prices are supplier assertions, not payment authority. PostgreSQL recomputes totals.
export const importQuotationSchema = z.object({
  supplier_id: uuid,
  tender_id: uuid,
  publication_id: uuid,
  reference: z.string().trim().min(1).max(120),
  lines: z.array(z.object({
    requirement_id: z.string().min(1).max(100),
    unit_net_minor: z.number().int().min(0).max(1_000_000_000),
  }).strict()).min(1).max(100),
  idempotency_key: uuid,
}).strict()

export const supplierSubmissionSchema = importQuotationSchema.extend({
  proposal_revision_id: uuid.optional(),
  evidence: z.array(z.object({ requirement_id: uuid, revision_id: uuid }).strict()).max(100).default([]),
}).strict()

export const receiptSchema = z.object({
  order_id: uuid,
  idempotency_key: uuid,
  note: z.string().trim().min(1).max(1000),
  lines: z.array(z.object({
    item_id: uuid,
    quantity: z.number().int().min(1).max(1_000_000),
  }).strict()).min(1).max(100),
}).strict()

export interface CommerceLine {
  id: string
  name: string
  quantity: number
  unit_net_minor: number
  net_amount_minor: number
  tax_amount_minor: number | null
  catalog_item_id?: string | null
  received_quantity?: number
}

export interface ProcurementQuotation {
  id: string
  title: string
  supplier_id: string
  supplier_name: string
  tender_id: string
  tender_title: string
  publication_id: string
  procurement_revision: number
  currency: string
  net_amount_minor: number
  tax_amount_minor: number | null
  recorded_at: string
  reference: string
  source: "buyer_recorded" | "supplier_submitted"
  lines: CommerceLine[]
  award_id: string | null
}

export interface ProcurementOrder {
  id: string
  award_id: string
  quotation_id: string
  supplier_name: string
  currency: string
  net_amount_minor: number
  tax_amount_minor: number
  created_at: string
  lines: (CommerceLine & { tax_amount_minor: number })[]
}

export interface ImportOption {
  tender_id: string
  publication_id: string
  title: string
  currency: string
  participation_deadline: string
  suppliers: { id: string; name: string }[]
  requirements: { id: string; description: string; quantity: number; unit: string }[]
}