import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { BillingIntervalSelector } from '@/app/components/billing/billing-interval-selector'
import { SubscriptionPlans } from '@/app/components/billing/subscription-plans'
import { ConnectedAccountsAddons } from '@/app/components/billing/connected-accounts-addons'
import { SubscriptionPromotionCard } from '@/app/components/billing/subscription-promotion-card'
import { BillingSetupWarning } from '@/app/components/billing/billing-setup-warning'
import { BILLING_INITIALIZATION_WARNING } from '@/app/services/initialize-site-billing'
import { PaymentHistory } from '@/app/components/billing/payment-history'
import BillingSuccessPage from '@/app/billing/success/page'
import es from '@/app/context/locales/es.json'

jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => undefined }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams('plan=engine&billingInterval=month'),
}))

const mockRefresh = jest.fn(async () => undefined)
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({
  currentSite: { id: 'site-example', name: 'Example workspace', billing: { plan: 'engine', billing_interval: 'year' } },
  refreshSites: mockRefresh,
}) }))
const mockPayments = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: () => ({
  select: () => ({ eq: () => ({ order: mockPayments }) }),
}) }) }))

const spanish = es as Record<string, string>
const translated = (key: string) => spanish[key]
const renderSpanish = (children: React.ReactNode) => render(
  <LocalizationProvider>{children}</LocalizationProvider>
)

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.setItem('makinari-locale', 'es')
  mockPayments.mockResolvedValue({ data: [], error: null })
})

afterEach(() => {
  localStorage.clear()
  document.cookie = 'makinari-locale=; path=/; max-age=0'
})

describe('billing UI with the real Spanish locale provider', () => {
  it('translates interval controls, plan allowances and interpolated plan actions', () => {
    const onChange = jest.fn()
    renderSpanish(<>
      <BillingIntervalSelector value="month" onChange={onChange} disabled={false} />
      <SubscriptionPlans currentPlan="commission" billingInterval="year" isSaving={false} onChangePlan={onChange} />
    </>)

    expect(screen.getByRole('tablist', { name: 'Período de facturación' })).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Anual — ahorra un 10 %' }), { button: 0, ctrlKey: false })
    expect(onChange).toHaveBeenCalledWith('year')
    expect(screen.getByText(/20 créditos\/mes/)).toBeInTheDocument()
    const upgrade = screen.getByRole('button', { name: /Engine.*anual/ })
    expect(upgrade).not.toHaveTextContent('Upgrade')
    fireEvent.click(upgrade)
    expect(onChange).toHaveBeenCalledWith('engine')
    expect(screen.queryByText(/includes owner and pending invitations/)).not.toBeInTheDocument()
  })

  it('translates connected-account usage and annual add-on pricing', () => {
    renderSpanish(<ConnectedAccountsAddons totalSocialAccounts={4} totalAgentChannels={1}
      socialLimit={3} agentLimit={1} addonsCount={2} billingInterval="year" requiredAddons={1}
      missingAddons={0} socialUsagePercentage={80} agentUsagePercentage={100}
      isSaving={false} onManageAddons={jest.fn()} />)

    expect(screen.getByRole('button', { name: 'Añadir un complemento' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar un complemento' })).toBeInTheDocument()
    expect(screen.queryByText(/Each add-on costs/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/\$108\.00/).length).toBeGreaterThan(0)
  })

  it('translates promotion validation and confirmed success without changing the request', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ success: true, alreadyApplied: false }),
    } as Response)
    try {
      renderSpanish(<SubscriptionPromotionCard siteId="site-example" />)
      const input = screen.getByRole('textbox', { name: /Código promocional/i })
      const apply = screen.getByRole('button', { name: /Aplicar código/i })
      fireEvent.click(apply)
      expect(screen.getByRole('alert')).toHaveTextContent(/código promocional/i)
      expect(fetchMock).not.toHaveBeenCalled()
      fireEvent.change(input, { target: { value: 'SAVE20' } })
      fireEvent.click(apply)
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/aplicado.*suscripción/i))
      expect(fetchMock).toHaveBeenCalledWith('/api/stripe/subscription/promotion', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ siteId: 'site-example', code: 'SAVE20' }),
      }))
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/aplicado.*suscripción/i))
      expect(screen.queryByText('Promotion code applied to your subscription.')).not.toBeInTheDocument()
    } finally {
      fetchMock.mockRestore()
    }
  })

  it('translates the shared setup-service warning and recovery action', () => {
    renderSpanish(<BillingSetupWarning message={BILLING_INITIALIZATION_WARNING} isLoading={false} onRetry={jest.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent(translated('billing.setup.initializationWarning'))
    expect(screen.getByRole('button', { name: 'Reintentar la configuración de facturación' })).toBeInTheDocument()
    expect(screen.queryByText(BILLING_INITIALIZATION_WARNING)).not.toBeInTheDocument()
  })

  it('translates payment statuses and formats history dates in Spanish', async () => {
    const createdAt = '2026-10-08T12:00:00.000Z'
    mockPayments.mockResolvedValue({ error: null, data: ['success', 'pending', 'failed'].map((status, index) => ({
      id: `payment-${index}`, transaction_id: `transaction-${index}`, transaction_type: 'subscription',
      amount: 23, status, created_at: createdAt,
    })) })
    renderSpanish(<PaymentHistory />)
    await waitFor(() => expect(screen.getAllByText('$23.00')).toHaveLength(3))
    for (const status of ['success', 'pending', 'failed']) {
      expect(screen.getByText(translated(`billing.payment.status.${status}`))).toBeInTheDocument()
      expect(screen.queryByText(new RegExp(`^${status}$`, 'i'))).not.toBeInTheDocument()
    }
    const date = new Intl.DateTimeFormat('es', { year: 'numeric', month: 'long', day: 'numeric' })
      .format(new Date(createdAt))
    expect(screen.getAllByText(date)).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: translated('billing.payment.table.download') })).toHaveLength(3)
  })

  it('translates the checkout-return screen while using the persisted annual subscription', async () => {
    renderSpanish(<BillingSuccessPage />)
    await waitFor(() => expect(screen.getByText(/\$248\.40\/año/)).toBeInTheDocument())
    expect(screen.queryByText('Current plan price')).not.toBeInTheDocument()
    expect(screen.queryByText('Continue to Dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Awaiting billing confirmation')).not.toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalledTimes(1)
  })
})