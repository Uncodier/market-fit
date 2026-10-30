import type { PurchasedSubscription } from '@/app/purchases/subscriptions/types'

const plans: Record<string, Array<[string, string, number]>> = {
  'demo-saas-en-123': [
    ['Northstar Cloud', 'Cloud infrastructure', 249],
    ['Cedar Software', 'Team collaboration', 89],
    ['Bright Academy', 'Engineering training', 120],
    ['Atlas Analytics', 'Analytics platform', 59],
    ['Harbor Security', 'Security monitoring', 180],
  ],
  'demo-ecom-es-456': [
    ['Parcel Network', 'Shipping automation', 149],
    ['Studio Supply', 'Product photography', 95],
    ['Retail Academy', 'Retail training', 75],
    ['Stockwise', 'Inventory planning', 49],
    ['Harbor Support', 'Customer support platform', 110],
  ],
  'demo-habituall': [
    ['Wellness Network', 'Instructor resources', 99],
    ['Studio Supply', 'Studio management', 79],
    ['Movement Academy', 'Instructor training', 150],
    ['Member Insights', 'Member analytics', 39],
    ['Harbor Spaces', 'Coworking access', 125],
  ],
}

/** Fictional presentation data only. Never insert these records into a database. */
export function demoPurchasedSubscriptions(siteId: string): PurchasedSubscription[] {
  const statuses = ['active', 'active', 'paused', 'cancelled', 'expired']
  return (plans[siteId] || []).map(([supplier, plan, amount], index) => {
    const id = `${siteId}-purchased-subscription-${index + 1}`
    const active = index < 3
    return {
      id,
      site_id: `${siteId}-supplier-${index + 1}`,
      catalog_item_id: `${id}-plan`,
      status: statuses[index],
      amount,
      created_at: `2026-0${index + 3}-01T12:00:00Z`,
      updated_at: '2026-10-20T12:00:00Z',
      start_date: `2026-0${index + 3}-01`,
      end_date: active ? null : '2026-09-30',
      next_billing_date: index < 2 ? '2026-11-01' : null,
      site: { id: `${siteId}-supplier-${index + 1}`, name: supplier },
      catalog_item: { id: `${id}-plan`, name: plan, currency: 'USD' },
      entitlements: active ? [{
        id: `${id}-access`,
        uses_remaining: index === 2 ? 4 : null,
        catalog_item: { name: index === 2 ? 'Training sessions' : 'Workspace license', digital_subtype: index === 2 ? 'pass' : 'license' },
      }] : [],
    }
  })
}