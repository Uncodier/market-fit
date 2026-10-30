import type { BuyerHomeSummary } from '@/app/buyer/components/BuyerHomeView'

// Presentation only: these records are never persisted or sent to an API.
export function getDemoHomeSummary(now = new Date()): BuyerHomeSummary {
  function reservation(id: string, name: string, days: number, status: string) {
    const start = new Date(now)
    start.setDate(start.getDate() + days)
    start.setHours(10, 0, 0, 0)
    return {
      id: `demo-reservation-${id}`,
      start_time: start.toISOString(),
      end_time: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
      status,
      entitlement_id: `demo-entitlement-${id}`,
      site: { name: 'Acme Workplace' },
      catalog_item: { name, image_url: null },
      entitlement: null,
    }
  }

  return {
    user: { email: 'alex.morgan@example.com', user_metadata: { full_name: 'Alex Morgan' } },
    counts: { sites: 2, orders: 12, subscriptions: 3, quotes: 4, library: 18, courses: 3, tickets: 2, files: 8, passes: 5 },
    newCounts: { orders: 2, subscriptions: 1, quotes: 2, courses: 1, tickets: 2, files: 3, passes: 0 },
    recentOrders: [],
    activeReservations: [
      reservation('consultation', 'Technology consultation', 1, 'confirmed'),
      reservation('workshop', 'Product strategy workshop', 3, 'pending'),
    ],
    recentReservations: [
      reservation('onboarding', 'Workspace onboarding', -2, 'completed'),
      reservation('training', 'Supplier training session', -7, 'completed'),
    ],
  }
}