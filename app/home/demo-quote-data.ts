import type { BuyerQuoteDto } from '@/app/buyer/quote-dto'
import { demoAccountQuotes } from './demo-commerce'

const titles = ['Workspace starter kit', 'Studio equipment bundle', 'Learning resource package', 'Design workshop supplies']

/** Enrich the existing list rows, keeping identity, seller, dates, status and totals identical. */
export const demoQuoteDetails: BuyerQuoteDto[] = demoAccountQuotes.map((quote, index) => ({
  ...quote,
  site_id: quote.site.id,
  site: { ...quote.site, logo_url: null, url: 'https://acme.example' },
  title: titles[index],
  lead: { name: 'Alex Demo', email: 'alex@example.test' },
  notes: '## Commercial terms\n\n- Quoted prices are in USD.\n- Delivery within 10 business days.\n- Payment is due on delivery.',
  subtotal: quote.total,
  discount_total: 0,
  tax_total: 0,
  items: [{
    id: `${quote.id}-item-1`,
    catalog_item_id: null,
    name: titles[index],
    quantity: 2,
    unit_price: quote.total / 2,
    subtotal: quote.total,
    catalog_item: null,
  }],
}))

export function findDemoQuoteDetail(id: string): BuyerQuoteDto | undefined {
  return demoQuoteDetails.find(quote => quote.id === id)
}