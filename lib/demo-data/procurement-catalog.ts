import type { CatalogProcurement } from '@/app/catalog/procurement/schema'

export function demoCatalogProcurement(itemId: string): CatalogProcurement {
  return {
    item: { id: itemId, name: 'Demo procurement item', status: 'active', procurement_enabled: true },
    can_edit: false, can_add_offer: false, total: 2,
    suppliers: [{ id: 'demo-supplier-northstar', name: 'Northstar Technology', status: 'approved' },
      { id: 'demo-supplier-summit', name: 'Summit Solutions', status: 'under_review' }],
    offers: [
      { id: 'demo-offer-northstar', supplier_id: 'demo-supplier-northstar', purchase_unit: 'Unit', units_per_purchase_unit: 1,
        minimum_quantity: 20, lead_time_days: 10, currency: 'USD', unit_price_minor: 12000,
        valid_from: '2026-01-01', valid_until: '2027-12-31', terms: 'Fictional offer. Net 30. Includes onboarding.', created_at: '2026-10-20T09:00:00Z' },
      { id: 'demo-offer-summit', supplier_id: 'demo-supplier-summit', purchase_unit: 'Unit', units_per_purchase_unit: 1,
        minimum_quantity: 10, lead_time_days: 7, currency: 'USD', unit_price_minor: 14500,
        valid_from: '2026-01-01', valid_until: '2027-12-31', terms: 'Fictional offer. Net 15. Priority delivery.', created_at: '2026-10-21T09:00:00Z' },
    ],
  }
}