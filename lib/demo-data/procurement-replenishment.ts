import type { ReplenishmentRule } from '@/app/purchases/procurement/replenishment/schema'

export const demoReplenishmentRules: ReplenishmentRule[] = [
  { id: 'demo-minimum-adapters', version: 1, name: 'USB-C adapters · Main office',
    catalog_item_id: 'demo-product-adapters', location_id: 'demo-location-office',
    minimum: 10, target: 40, minimum_order: 5, order_multiple: 5, action: 'draft', enabled: true },
  { id: 'demo-minimum-cables', version: 1, name: 'Network cables · Service desk',
    catalog_item_id: 'demo-product-cables', location_id: 'demo-location-office',
    minimum: 20, target: 60, minimum_order: 10, order_multiple: 10, action: 'alert', enabled: false },
]

export const demoReplenishmentCases = [{
  id: 'demo-case-adapters', rule_id: 'demo-minimum-adapters', rule_name: 'USB-C adapters · Main office',
  request_id: null, observed_quantity: 5, quantity: 35, action: 'alert',
}]