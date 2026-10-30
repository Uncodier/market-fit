import { render, screen } from '@testing-library/react'
import { BuyerListSkeleton, BuyerListContentSkeleton } from '@/app/buyer/components/BuyerListSkeleton'
import { BuyerQuoteDetailSkeleton } from '@/app/buyer/components/BuyerQuoteDetailSkeleton'
import { BuyerOrderDetailSkeleton } from '@/app/buyer/components/BuyerOrderDetailSkeleton'
import { BuyerLibraryView } from '@/app/buyer/components/BuyerLibraryView'
import { BuyerSubscriptionsView } from '@/app/buyer/components/BuyerSubscriptionsView'
import { BuyerOrdersView } from '@/app/buyer/components/BuyerOrdersView'
import { BuyerQuotesView } from '@/app/buyer/components/BuyerQuotesView'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: () => '' }),
}))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/buyer/actions', () => ({ getUserSites: jest.fn().mockResolvedValue({ data: [] }) }))
jest.mock('swr', () => ({ __esModule: true, default: () => ({ isLoading: true }) }))

test.each(['library', 'subscriptions'] as const)('%s content preserves the settled image grid and card footer', kind => {
  const { container } = render(<BuyerListContentSkeleton kind={kind} />)
  expect(screen.getByRole('status', { name: 'Loading' })).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('.grid')).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-6')
  expect(container.querySelectorAll('.aspect-video')).toHaveLength(6)
  expect(container.querySelectorAll('.mt-auto.pt-4.border-t')).toHaveLength(6)
  expect(container.querySelector('table')).toBeNull()
})

test.each([
  ['library', BuyerLibraryView], ['subscriptions', BuyerSubscriptionsView],
  ['orders', BuyerOrdersView], ['quotes', BuyerQuotesView],
] as const)('%s in-page fetch uses the route-reusable content', (kind, View) => {
  const { container } = render(<View scope="site" />)
  expect(container.querySelector('[data-buyer-list-skeleton]')).toHaveAttribute('data-buyer-list-skeleton', kind)
})

test('orders reserve purchase metadata header, item body and action column, not a table', () => {
  const { container } = render(<BuyerListSkeleton kind="orders" navigation={<span>Online purchases</span>} />)
  expect(screen.getByText('Online purchases')).toBeVisible()
  expect(container.querySelector('.overflow-auto')).toHaveClass('px-4', 'md:px-0', 'py-4', 'md:py-6')
  expect(container.querySelectorAll('.space-y-6 > .overflow-hidden')).toHaveLength(3)
  expect(container.querySelectorAll('.px-5.py-3')).toHaveLength(3)
  expect(container.querySelectorAll('.md\\:w-56')).toHaveLength(3)
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('.sticky')).toBeNull()
})

test('quotes reuse the five-column document table', () => {
  const { container } = render(<BuyerListSkeleton kind="quotes" scope="site" />)
  expect(container.querySelectorAll('thead th')).toHaveLength(5)
  expect(container.querySelector('.overflow-auto')).toHaveClass('p-4', 'md:p-6', 'lg:p-8')
})

test('quote detail reserves centered paper, parties, items and right-aligned totals', () => {
  const { container } = render(<BuyerQuoteDetailSkeleton />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('.max-w-4xl')).toHaveClass('mx-auto', 'space-y-6')
  expect(container.querySelector('.min-h-\\[72px\\]')).not.toBeNull()
  expect(container.querySelector('.sm\\:grid-cols-2')).not.toBeNull()
  expect(container.querySelector('.max-w-\\[300px\\]')).toHaveClass('ml-auto')
  expect(container.querySelector('.sticky')).toBeNull()
})

test('order detail uses desktop item column header instead of a card title', () => {
  const { container } = render(<BuyerOrderDetailSkeleton />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelectorAll('.w-\\[120px\\]')).toHaveLength(9)
  expect(container.querySelector('.md\\:grid-cols-2')).not.toBeNull()
})