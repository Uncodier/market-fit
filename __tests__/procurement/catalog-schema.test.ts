import { capabilitySchema, sourcingOfferSchema } from '@/app/catalog/procurement/schema'

export const validOffer = { supplier_id: '00000000-0000-4000-8000-000000000071', purchase_unit: 'box',
  units_per_purchase_unit: 12, minimum_quantity: 2, lead_time_days: 7, currency: 'USD',
  unit_price_minor: 1200, valid_from: '2026-10-01', valid_until: '2026-12-31', terms: 'Net 30' }

describe('catalog procurement validation', () => {
  it('accepts dated offers and independent procurement capability', () => {
    expect(sourcingOfferSchema.safeParse(validOffer).success).toBe(true)
    expect(capabilitySchema.safeParse({ procurement_enabled: true, expected_enabled: false }).success).toBe(true)
  })
  it.each([
    { unit_price_minor: -1 }, { unit_price_minor: 1.5 }, { unit_price_minor: Number.MAX_SAFE_INTEGER + 1 },
    { currency: 'usd' }, { minimum_quantity: 0 }, { units_per_purchase_unit: 0.0000001 },
    { valid_from: '2026-02-30' }, { valid_until: '2025-12-31' }, { lead_time_days: -1 },
    { site_id: 'forged' }, { created_by: 'forged' }, { sales_enabled: false },
  ])('rejects invalid or authority-bearing values: %j', invalid => {
    expect(sourcingOfferSchema.safeParse({ ...validOffer, ...invalid }).success).toBe(false)
  })
  it('cannot set legacy sale flags or introduce a sales-disabled item', () => {
    expect(capabilitySchema.safeParse({ procurement_enabled: true, expected_enabled: false, is_purchasable: false }).success).toBe(false)
    expect(capabilitySchema.safeParse({ procurement_enabled: true, expected_enabled: false, sales_enabled: false }).success).toBe(false)
  })
})