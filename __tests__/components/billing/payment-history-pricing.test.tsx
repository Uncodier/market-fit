import { render, screen } from '@testing-library/react'
import { PaymentHistory } from '@/app/components/billing/payment-history'
import { useSite } from '@/app/context/SiteContext'
import { createClient } from '@/lib/supabase/client'

jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

it('renders monthly payments without a stray zero and retains purchased-credit quantities', async () => {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: 'site-history' } } as never)
  const row = { amount: 99, status: 'completed', transaction_type: 'subscription', created_at: '2026-09-25T12:00:00Z' }
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({
    data: [
      { ...row, id: 'payment-monthly', credits: 0 },
      { ...row, id: 'payment-purchase', transaction_type: 'credit_purchase', amount: 0, credits: 100 },
    ], error: null,
  }) }
  jest.mocked(createClient).mockReturnValue({ from: jest.fn().mockReturnValue(query) } as never)
  render(<PaymentHistory />)
  expect(await screen.findByText('Subscription Payment')).toBeInTheDocument()
  expect(screen.queryByText('Subscription Payment0')).not.toBeInTheDocument()
  expect(screen.getByText('Credit Purchase (100 credits)')).toBeInTheDocument()
  expect(screen.getByText('$99.00')).toBeInTheDocument()
  expect(query.eq).toHaveBeenCalledWith('site_id', 'site-history')
})