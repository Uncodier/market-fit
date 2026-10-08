import { render, screen } from '@testing-library/react'
import BillingPage from '@/app/billing/page'
import { useSite } from '@/app/context/SiteContext'

jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => null }))
jest.mock('@/app/billing/use-billing-target', () => ({ useBillingTarget: () => ({ pending: false, error: null, requestedId: null }) }))
jest.mock('@/app/create-site/site-setup-tracking', () => ({ SiteSetupTracking: () => null }))
jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/components/billing/billing-form', () => ({ BillingForm: () => <div>Subscription controls</div> }))
jest.mock('@/app/components/billing/payment-history', () => ({ PaymentHistory: () => null }))
jest.mock('@/app/components/billing/credit-usage-history', () => ({ CreditUsageHistory: () => null }))
jest.mock('@/app/components/ui/quick-nav', () => ({ QuickNav: () => null }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => children }))

it('blocks subscription controls on financial read errors, not on confirmed monthly billing', () => {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: 'site-monthly', billing_read_status: 'unavailable' }, isLoading: false } as never)
  const view = render(<BillingPage />)
  expect(screen.getByRole('alert')).toHaveTextContent('does not mean your subscription is unpaid')
  expect(screen.getByRole('button', { name: 'Retry loading billing' })).toBeInTheDocument()
  expect(screen.queryByText('Subscription controls')).not.toBeInTheDocument()
  jest.mocked(useSite).mockReturnValue({ currentSite: {
    id: 'site-monthly', billing_read_status: 'loaded', billing: { plan: 'foundry', billing_interval: 'month', credits_available: 42 },
  }, isLoading: false } as never)
  view.rerender(<BillingPage />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Subscription controls')).toBeInTheDocument()
})