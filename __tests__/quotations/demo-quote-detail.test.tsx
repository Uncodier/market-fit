import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DemoQuoteDetail } from '@/app/home/demo-quote-detail'
import { demoQuoteDetails, findDemoQuoteDetail } from '@/app/home/demo-quote-data'
import { demoAccountQuotes } from '@/app/home/demo-commerce'
import { BuyerQuotePresentation } from '@/app/buyer/components/BuyerQuotePresentation'
import { BuyerQuoteDetailView } from '@/app/buyer/components/BuyerQuoteDetailView'
import { getBuyerQuotation } from '@/app/buyer/quote-actions'
import { startQuoteCheckout } from '@/app/commerce/quote-cart'
import { rejectQuotation } from '@/app/quotations/buyer-actions'
import { getQuotationByPublicToken, rejectQuotationByPublicToken } from '@/app/quotations/public-actions'

jest.mock('next/navigation', () => ({
  notFound: () => { throw new Error('Not found') },
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key.startsWith('status.') ? key.slice(7) : key === 'procurement.common.taxesPending' ? 'Taxes pending' : '' }),
}))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock('@/app/components/commerce/DestinationSelector', () => ({ DestinationSelector: () => { throw new Error('Unexpected destination loading') } }))
jest.mock('@/app/documents/components/PublicDocumentShopNav', () => ({ PublicDocumentShopNav: () => null }))
jest.mock('@/app/documents/components/PublicDocumentViewSkeleton', () => ({ PublicDocumentViewSkeleton: () => null }))
jest.mock('@/app/buyer/quote-actions', () => ({ getBuyerQuotation: jest.fn() }))
jest.mock('@/app/quotations/actions', () => ({ getQuotation: jest.fn() }))
jest.mock('@/app/quotations/buyer-actions', () => ({ rejectQuotation: jest.fn() }))
jest.mock('@/app/quotations/public-actions', () => ({ getQuotationByPublicToken: jest.fn(), rejectQuotationByPublicToken: jest.fn() }))
jest.mock('@/app/commerce/quote-cart', () => ({ startQuoteCheckout: jest.fn(() => '/cart/checkout') }))
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/simple-messages-view/utils/markdownComponents', () => ({ markdownComponents: {} }))

beforeEach(() => jest.clearAllMocks())

test('detail fixtures preserve every existing quotation list contract and reconcile line totals', () => {
  expect(demoQuoteDetails).toHaveLength(demoAccountQuotes.length)
  demoAccountQuotes.forEach(row => {
    const quote = findDemoQuoteDetail(row.id)!
    expect(quote).toMatchObject(row)
    expect(quote.items.reduce((sum, item) => sum + item.subtotal, 0)).toBe(quote.subtotal)
    expect(quote.subtotal! + quote.tax_total! - quote.discount_total!).toBe(quote.total)
    expect(quote.items[0].quantity * quote.items[0].unit_price).toBe(quote.items[0].subtotal)
  })
})

test.each(demoAccountQuotes.map(row => [row.id, row.status, row.total] as const))(
  'renders actual document for %s with inert response controls', (id, status, total) => {
    render(DemoQuoteDetail({ id }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quote demo-acc')
    expect(screen.getByRole('table')).toHaveTextContent(findDemoQuoteDetail(id)!.items[0].name)
    expect(screen.getAllByText(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)).length).toBeGreaterThan(0)
    expect(screen.getByText(status)).toBeInTheDocument()
    expect(screen.getByText('Alex Demo')).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/home/quotes')
    if (status === 'sent') {
      const reject = screen.getByRole('button', { name: 'Reject' })
      const checkout = screen.getByRole('button', { name: 'Proceed to Checkout' })
      expect(reject).toBeDisabled()
      expect(checkout).toBeDisabled()
      fireEvent.click(reject)
      fireEvent.click(checkout)
    } else {
      expect(screen.queryByRole('button', { name: 'Proceed to Checkout' })).not.toBeInTheDocument()
    }
    expect(getBuyerQuotation).not.toHaveBeenCalled()
    expect(startQuoteCheckout).not.toHaveBeenCalled()
    expect(rejectQuotation).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  },
)

test('unknown quotation IDs fail closed without loading real data', () => {
  expect(() => DemoQuoteDetail({ id: 'real-quote-id' })).toThrow('Not found')
  expect(getBuyerQuotation).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

test('demo suppresses supplied callbacks and backend-capable slots', () => {
  const action = jest.fn()
  render(<BuyerQuotePresentation quotation={demoQuoteDetails[0]} demo onAccept={action} onReject={action}
    destination={<span>Live destination</span>} publicNavigation={<span>Live shop</span>} />)
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
  expect(action).not.toHaveBeenCalled()
  expect(screen.queryByText('Live destination')).not.toBeInTheDocument()
  expect(screen.queryByText('Live shop')).not.toBeInTheDocument()
})

test('live buyer controller uses the same document but retains real checkout behavior', async () => {
  jest.mocked(getBuyerQuotation).mockResolvedValue({ data: demoQuoteDetails[0] })
  render(<BuyerQuoteDetailView quoteId={demoQuoteDetails[0].id} />)
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  expect(getBuyerQuotation).toHaveBeenCalledWith(demoQuoteDetails[0].id)
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Proceed to Checkout' }))
  expect(startQuoteCheckout).toHaveBeenCalledWith(demoQuoteDetails[0], {
    returnTo: '/buyer', ownerSiteId: null, publicAccessToken: null,
  })
})

test('live public-token controller preserves token-scoped loading and rejection', async () => {
  jest.mocked(getQuotationByPublicToken).mockResolvedValue({ data: demoQuoteDetails[0] })
  jest.mocked(rejectQuotationByPublicToken).mockResolvedValue({ success: true })
  render(<BuyerQuoteDetailView publicAccessToken="public-token" backHref={null} />)
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(getQuotationByPublicToken).toHaveBeenCalledTimes(2))
  expect(rejectQuotationByPublicToken).toHaveBeenCalledWith('public-token')
  expect(rejectQuotation).not.toHaveBeenCalled()
  expect(getBuyerQuotation).not.toHaveBeenCalled()
})

test.each(['expired', 'taxes pending'])('shared document preserves the %s state', state => {
  const quote = { ...demoQuoteDetails[0], ...(state === 'expired' ? { valid_until: '2000-01-01T00:00:00Z' } : { total: null, tax_total: null }) }
  render(<BuyerQuotePresentation quotation={quote} />)
  if (state === 'expired') {
    expect(screen.getByText(/This quote has expired/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Proceed to Checkout' })).not.toBeInTheDocument()
  } else {
    expect(screen.getAllByText('Taxes pending').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Proceed to Checkout' })).toBeDisabled()
  }
})