import { notFound } from 'next/navigation'
import { isProcurementPortalDemo } from '@/app/tenders/demo-mode'
import { demoAccountOrders } from '@/app/home/demo-commerce'
import { BuyerOrderDetailView } from '@/app/buyer/components/BuyerOrderDetailView'
import { DemoReservationDetail, DemoSubscriptionDetail } from '@/app/home/demo-service-details'
import { DemoLibraryDetail } from '@/app/home/demo-library-detail'
import { DemoQuoteDetail } from '@/app/home/demo-quote-detail'

export default async function AccountPreview({ params }: { params: Promise<{ kind: string; id: string }> }) {
  if (!await isProcurementPortalDemo()) notFound()
  const { kind, id } = await params
  if (kind === 'reservations') return <DemoReservationDetail id={id} />
  if (kind === 'subscriptions') return <DemoSubscriptionDetail id={id} />
  if (kind === 'library') return <DemoLibraryDetail id={id} />
  if (kind === 'quotes') return <DemoQuoteDetail id={id} />
  if (kind === 'orders') {
    const order = demoAccountOrders.find(row => row.id === id)
    if (!order) notFound()
    return <BuyerOrderDetailView key={order.id} orderId={order.id} previewOrder={order} backHref="/home/orders" />
  }
  notFound()
}