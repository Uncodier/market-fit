import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import BillingSuccessPage from '@/app/billing/success/page'

const mockBilling = { plan: 'engine', billing_interval: 'year', addons_count: 0,
  paid_subscription_invoice_id: '', paid_subscription_plan: '', paid_subscription_addons_count: 0 }
let mockQuery = 'plan=engine&billingInterval=month'
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams(mockQuery) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { name: 'Example workspace', billing: mockBilling }, refreshSites: jest.fn(async () => undefined) }) }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => undefined }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '', locale: 'en' }) }))

beforeEach(() => {
  mockQuery = 'plan=engine&billingInterval=month'
  Object.assign(mockBilling, { plan: 'engine', billing_interval: 'year', addons_count: 0,
    paid_subscription_invoice_id: '', paid_subscription_plan: '', paid_subscription_addons_count: 0 })
})

it('uses stored annual interval rather than the query for returned checkout pricing', async () => {
  render(<BillingSuccessPage />)
  await waitFor(() => expect(screen.getByText('$248.40/year')).toBeInTheDocument())
  expect(screen.getByText('$20.70/month equivalent · billed annually')).toBeInTheDocument()
  expect(screen.queryByText('$23/month')).not.toBeInTheDocument()
  expect(screen.queryByText(/is now active/)).not.toBeInTheDocument()
})

it('does not present query plan price as settled before the record matches', async () => {
  mockBilling.plan = 'commission'
  render(<BillingSuccessPage />)
  await waitFor(() => expect(screen.getByText('Awaiting billing confirmation')).toBeInTheDocument())
  expect(screen.queryByText('$248.40/year')).not.toBeInTheDocument()
  mockBilling.plan = 'engine'
})

it('shows persisted free add-ons without presenting a plan upgrade or purchased credits', async () => {
  mockQuery = 'plan=commission&billingInterval=month&addonsCount=99'
  Object.assign(mockBilling, { plan: 'commission', addons_count: 2, paid_subscription_invoice_id: 'in_addons',
    paid_subscription_plan: 'commission', paid_subscription_addons_count: 2 })
  render(<BillingSuccessPage />)
  await waitFor(() => expect(screen.getByText('$216.00/year')).toBeInTheDocument())
  expect(screen.getByText('Free Plan')).toBeInTheDocument()
  expect(screen.getByText('Current add-ons: 2. Your base plan remains free.')).toBeInTheDocument()
  expect(screen.queryByText('Credits Purchased')).not.toBeInTheDocument()
})

it('does not treat a free-plan return URL as proof of add-on payment', async () => {
  mockQuery = 'plan=commission'
  mockBilling.plan = 'commission'
  render(<BillingSuccessPage />)
  await waitFor(() => expect(screen.getByText('Awaiting billing confirmation')).toBeInTheDocument())
  expect(screen.queryByText(/Your base plan remains free/)).not.toBeInTheDocument()
  expect(screen.queryByText('Payment Successful!')).not.toBeInTheDocument()
})