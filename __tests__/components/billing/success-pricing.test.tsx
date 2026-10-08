import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import BillingSuccessPage from '@/app/billing/success/page'

const mockBilling = { plan: 'engine', billing_interval: 'year' }
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams('plan=engine&billingInterval=month') }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { name: 'Example workspace', billing: mockBilling }, refreshSites: jest.fn(async () => undefined) }) }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => undefined }))

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