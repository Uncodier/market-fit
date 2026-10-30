import { render, screen } from '@testing-library/react'
import AccountPreview from '@/app/home/preview/[kind]/[id]/page'
import { isProcurementPortalDemo } from '@/app/tenders/demo-mode'

jest.mock('@/app/tenders/demo-mode', () => ({ isProcurementPortalDemo: jest.fn() }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), notFound: () => { throw new Error('Not found') } }))
jest.mock('@/app/buyer/actions', () => ({ getBuyerOrder: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/home/demo-service-details', () => ({
  DemoSubscriptionDetail: ({ id }: { id: string }) => <div data-testid="subscription-detail">{id}</div>,
  DemoReservationDetail: ({ id }: { id: string }) => <div data-testid="reservation-detail">{id}</div>,
}))
jest.mock('@/app/home/demo-library-detail', () => ({ DemoLibraryDetail: ({ id }: { id: string }) => <div>{id}</div> }))
jest.mock('@/app/home/demo-quote-detail', () => ({ DemoQuoteDetail: ({ id }: { id: string }) => <div>{id}</div> }))

beforeEach(() => { jest.clearAllMocks(); jest.mocked(isProcurementPortalDemo).mockResolvedValue(true) })

test.each([
  ['orders', 'demo-order-1', 'Purchase DEMO-1001'],
  ['subscriptions', 'demo-subscription-1', 'demo-subscription-1'],
  ['reservations', 'demo-reservation-consultation', 'demo-reservation-consultation'],
  ['quotes', 'demo-account-quote-1', 'demo-account-quote-1'],
  ['library', 'demo-course-1', 'demo-course-1'],
  ['library', 'demo-pass-1', 'demo-pass-1'],
  ['library', 'demo-ticket-1', 'demo-ticket-1'],
  ['library', 'demo-file-1', 'demo-file-1'],
])('renders %s detail without requests', async (kind, id, title) => {
  render(await AccountPreview({ params: Promise.resolve({ kind, id }) }))
  expect(screen.getByText(title)).toBeInTheDocument()
  if (kind === 'orders') expect(screen.getByRole('link', { name: 'Back to orders' })).toHaveAttribute('href', '/home/orders')
  expect(fetch).not.toHaveBeenCalled()
})

test.each([['orders', 'real-id'], ['unknown', 'demo-order-1']])('rejects unknown fixture %s/%s', async (kind, id) => {
  await expect(AccountPreview({ params: Promise.resolve({ kind, id }) })).rejects.toThrow('Not found')
})

test('does not expose the preview when demo is off', async () => {
  jest.mocked(isProcurementPortalDemo).mockResolvedValue(false)
  await expect(AccountPreview({ params: Promise.resolve({ kind: 'orders', id: 'demo-order-1' }) })).rejects.toThrow('Not found')
})