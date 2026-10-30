import { notFound } from 'next/navigation'
import { BuyerQuotePresentation } from '@/app/buyer/components/BuyerQuotePresentation'
import { findDemoQuoteDetail } from './demo-quote-data'

/** Server dispatcher: only local list fixtures can reach the inert shared quote view. */
export function DemoQuoteDetail({ id }: { id: string }) {
  const quotation = findDemoQuoteDetail(id)
  if (!quotation) notFound()
  return <BuyerQuotePresentation quotation={quotation} backHref="/home/quotes" demo />
}