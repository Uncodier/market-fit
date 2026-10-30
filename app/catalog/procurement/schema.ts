import { z } from 'zod'

export const catalogId = z.string().uuid()
const quantity = z.number().finite().positive().max(1_000_000_000)
  .refine(value => Math.abs(value * 1e6 - Math.round(value * 1e6)) < 0.001, 'Use at most six decimal places')
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}, 'Invalid date')
export const sourcingOfferSchema = z.object({
  supplier_id: catalogId,
  purchase_unit: z.string().trim().min(1).max(80),
  units_per_purchase_unit: quantity,
  minimum_quantity: quantity,
  lead_time_days: z.number().int().min(0).max(3650),
  currency: z.string().regex(/^[A-Z]{3}$/),
  unit_price_minor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  valid_from: date,
  valid_until: date,
  terms: z.string().max(4000),
}).strict().refine(value => value.valid_until >= value.valid_from, {
  message: 'Price end date must not precede its start date', path: ['valid_until'],
})
export const capabilitySchema = z.object({
  procurement_enabled: z.boolean(), expected_enabled: z.boolean(),
}).strict()
export type SourcingOfferInput = z.infer<typeof sourcingOfferSchema>
export type SourcingOffer = SourcingOfferInput & { id: string; created_at: string }
export type CatalogProcurement = {
  item: { id: string; name: string; status: string; procurement_enabled: boolean }
  offers: SourcingOffer[]
  suppliers: { id: string; name: string; status: string }[]
  total: number
  can_edit: boolean
  can_add_offer: boolean
}