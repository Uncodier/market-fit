import { notFound } from 'next/navigation'
import type { CatalogItem } from '@/app/types'
import { ServicePdpLayout } from '@/app/components/commerce/pdp/ServicePdpLayout'
import { ProductDetailPage } from '@/app/components/commerce/pdp/ProductDetailPage'
import { BuyerExperienceShell } from '@/app/components/commerce/pdp/BuyerExperienceShell'
import { demoAccountSubscriptions } from './demo-commerce'
import { getDemoHomeSummary } from './demo-summary'

function serviceItem(id: string, name: string, recurring = false, amount = 0): CatalogItem {
  return {
    id, name, site_id: 'demo-acme', site: { id: 'demo-acme', name: 'Acme Workplace' },
    description: `${name} from Acme Workplace.`,
    kind: 'service', currency: 'USD', target_sale_price: amount,
    image_url: '/images/logo.png', track_inventory: false,
    availability_mode: 'always', availability_status: 'available', status: 'active',
    sort_order: 0, is_pos_available: false, is_recurring: recurring,
    is_reservation: !recurring, created_at: '2026-10-20T10:00:00Z', updated_at: '2026-10-20T10:00:00Z',
    metadata: { attributes: { duration: '60 minutes' }, specs: [{ label: 'Host', value: 'Alex Morgan' }] },
  }
}

export function DemoReservationDetail({ id }: { id: string }) {
  const summary = getDemoHomeSummary()
  const row = [...summary.activeReservations, ...summary.recentReservations].find(row => row.id === id)
  if (!row) notFound()
  const item = serviceItem(`demo-service-${id}`, row.catalog_item?.name || 'Reservation')
  const reservation = { ...row, catalog_item: item, catalog_item_id: item.id, quantity: 1 }
  return <BuyerExperienceShell backUrl="/home" variant="reservation">
    <ServicePdpLayout item={item} backUrl="/home" experience={{
      kind: 'reservation', demo: true, reservation,
      extras: { schedules: [{ timezone: 'America/Los_Angeles' }] },
    }} />
  </BuyerExperienceShell>
}

export function DemoSubscriptionDetail({ id }: { id: string }) {
  const row = demoAccountSubscriptions.find(row => row.id === id)
  if (!row) notFound()
  const item = serviceItem(row.catalog_item.id, row.catalog_item.name, true, row.amount)
  return <ProductDetailPage item={item} site={row.site} backUrl="/home/subscriptions"
    experience={{ kind: 'subscription', demo: true, subscription: row }} />
}