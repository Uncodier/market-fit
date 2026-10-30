import { render, screen } from '@testing-library/react'
import { AccountScreenLoading } from '@/app/buyer/components/AccountScreenLoading'
import OrdersLoading from '@/app/home/orders/loading'
import QuotesLoading from '@/app/home/quotes/loading'
import LibraryLoading from '@/app/home/library/loading'
import SubscriptionsLoading from '@/app/home/subscriptions/loading'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ locale: 'en', t: (key: string) => key }),
}))
jest.mock('@/app/buyer/components/BuyerListSkeleton', () => ({
  BuyerListSkeleton: ({ kind }: { kind: string }) => <div data-testid="list" data-kind={kind} />,
}))
jest.mock('@/app/buyer/components/BuyerOrderDetailSkeleton', () => ({
  BuyerOrderDetailSkeleton: () => <div data-testid="order-detail" />,
}))
jest.mock('@/app/buyer/components/BuyerQuoteDetailSkeleton', () => ({
  BuyerQuoteDetailSkeleton: () => <div data-testid="quote-detail" />,
}))
jest.mock('@/app/buyer/book/[entitlementId]/loading', () => ({ __esModule: true, default: () => <div data-testid="booking" /> }))

test.each(['home', 'buyer'])('%s authentication fallback follows the current account list', base => {
  for (const kind of ['orders', 'quotes', 'subscriptions', 'library']) {
    const view = render(<AccountScreenLoading pathname={`/${base}/${kind}`} />)
    expect(screen.getByTestId('list')).toHaveAttribute('data-kind', kind)
    expect(view.container.querySelector('[data-account-skeleton="home"]')).toBeNull()
    view.unmount()
  }
})

test.each(['/buyer/orders/order-1', '/home/preview/orders/demo-order-1'])('order detail does not inherit list/home layout: %s', pathname => {
  render(<AccountScreenLoading pathname={pathname} />)
  expect(screen.getByTestId('order-detail')).toBeInTheDocument()
  expect(screen.queryByTestId('list')).not.toBeInTheDocument()
})

test.each(['/buyer/quotes/quote-1', '/home/preview/quotes/demo-quote-1'])('quote detail uses the document skeleton: %s', pathname => {
  render(<AccountScreenLoading pathname={pathname} />)
  expect(screen.getByTestId('quote-detail')).toBeInTheDocument()
  expect(screen.queryByTestId('list')).not.toBeInTheDocument()
})

test.each([
  ['orders', OrdersLoading], ['quotes', QuotesLoading], ['library', LibraryLoading], ['subscriptions', SubscriptionsLoading],
])('%s owns a nested loading boundary instead of inheriting the home grid', (kind, Loading) => {
  render(<Loading />)
  expect(screen.getByTestId('list')).toHaveAttribute('data-kind', kind)
})

test.each([
  ['/home', 'home'], ['/home/submissions', 'submissions'], ['/home/profile', 'profile'], ['/buyer/profile', 'profile'],
])('authentication preserves the screen structure for %s', (pathname, kind) => {
  const { container } = render(<AccountScreenLoading pathname={pathname} />)
  expect(container.querySelector(`[data-account-skeleton="${kind}"]`)).not.toBeNull()
  expect(container.querySelector('[data-account-skeleton="credentials"]') !== null).toBe(pathname === '/home/profile')
})