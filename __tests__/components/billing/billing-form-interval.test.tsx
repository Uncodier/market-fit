import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BillingForm } from '@/app/components/billing/billing-form'
import { billingService } from '@/app/services/billing-service'
import { toast } from 'sonner'
import { disconnectOutstandSocial, disconnectZavuChannel } from '@/app/components/settings/disconnect-remote-accounts'
import { countSocialAccounts } from '@/lib/billing-limits'

const mockUpdateBilling = jest.fn()
const mockNavigate = jest.fn()
const originalLocation = window.location
const mockSite = { id: 'site-example', billing: { plan: 'engine', billing_interval: 'month', addons_count: 0 } }

beforeAll(() => {
  window.matchMedia = jest.fn(query => ({
    matches: true, media: query, onchange: null, addListener: jest.fn(), removeListener: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
  }))
})

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite, updateBilling: mockUpdateBilling, refreshSites: jest.fn(), updateSettings: jest.fn() }) }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ user: { email: 'user@example.test' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/services/billing-service', () => ({ billingService: { createSubscriptionCheckoutSession: jest.fn(), createPortalSession: jest.fn() } }))
jest.mock('@/app/services/site-members-service', () => ({ siteMembersService: { getLicense: jest.fn().mockResolvedValue({ current: 1, total: 1 }) } }))
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }))
jest.mock('@/lib/billing-limits', () => ({ countSocialAccounts: jest.fn(() => 0), countAgentChannels: () => 0, getSocialAccountLimit: () => 3, getAgentChannelLimit: () => 1, getRequiredAddons: () => 0 }))
jest.mock('@/app/components/billing/stripe-payment-method', () => ({ StripePaymentMethod: () => null }))
jest.mock('@/app/components/billing/purchase-credits-dialog', () => ({ PurchaseCreditsDialog: () => null }))
jest.mock('@/app/components/billing/downgrade-channels-modal', () => ({ DowngradeChannelsModal: () => null }))
jest.mock('@/app/components/settings/disconnect-remote-accounts', () => ({ disconnectOutstandSocial: jest.fn(), disconnectZavuChannel: jest.fn() }))

describe('billing form interval contract', () => {
  beforeEach(() => {
    localStorage.clear(); jest.clearAllMocks(); window.history.replaceState({}, '', '/billing')
    Object.defineProperty(window, 'location', { configurable: true, value: {
      get href() { return originalLocation.href }, set href(value: string) { mockNavigate(value) },
      get search() { return originalLocation.search }, origin: originalLocation.origin,
    } })
    mockSite.billing.plan = 'engine'; mockSite.billing.billing_interval = 'month'; mockSite.billing.addons_count = 0
    jest.mocked(countSocialAccounts).mockReturnValue(0)
  })
  afterEach(() => Object.defineProperty(window, 'location', { configurable: true, value: originalLocation }))

  it('keeps credit information and purchase options without the usage history button', async () => {
    render(<BillingForm />)
    await waitFor(() => expect(screen.getByText('Minimum required plan')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /view usage history/i })).not.toBeInTheDocument()
    expect(screen.getByText('credits available')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Buy' })).toHaveLength(3)
  })

  it('does not schedule downgrades across intervals or disconnect providers', async () => {
    mockSite.billing.plan = 'foundry'
    jest.mocked(countSocialAccounts).mockReturnValue(6)
    render(<BillingForm />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Annual/ }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Starter annual' }))
    expect(toast.error).toHaveBeenCalledWith('Choose your current billing interval to schedule a downgrade, or contact billing support.')
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(disconnectOutstandSocial).not.toHaveBeenCalled()
    expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })

  it('submits same-plan annual change as fifth arg, shows server error and never changes billing optimistically', async () => {
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: false, error: 'Use billing support for subscriptions with add-ons' })
    render(<BillingForm />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Annual/ }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Switch Starter annual' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith('site-example', 'engine', 'user@example.test', 0, 'year'))
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Use billing support for subscriptions with add-ons')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Switch Starter annual' })).toBeEnabled())
    expect(screen.getByText('Current billing: Monthly')).toBeInTheDocument()
  })

  it('honors a direct annual URL from the commercial redirect without automatically starting checkout', async () => {
    window.history.replaceState({}, '', '/billing?billingInterval=year')
    render(<BillingForm />)
    await waitFor(() => expect(screen.getByRole('tab', { name: /Annual/ })).toHaveAttribute('aria-selected', 'true'))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })

  it('ignores invalid direct URL intent', async () => {
    window.history.replaceState({}, '', '/billing?billingInterval=invalid')
    render(<BillingForm />)
    expect(screen.getByRole('tab', { name: 'Monthly' })).toHaveAttribute('aria-selected', 'true')
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Minimum required plan')).toBeInTheDocument())
  })

  it('opens the cancellation portal before checking limits and never disconnects annual paid accounts', async () => {
    mockSite.billing.billing_interval = 'year'
    jest.mocked(countSocialAccounts).mockReturnValue(10)
    jest.mocked(billingService.createPortalSession).mockResolvedValue({ success: false, error: 'Example portal unavailable' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Toolbox monthly' }))
    await waitFor(() => expect(billingService.createPortalSession).toHaveBeenCalledWith('site-example', window.location.href))
    expect(disconnectOutstandSocial).not.toHaveBeenCalled()
    expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(screen.getByText('Current billing: Annual')).toBeInTheDocument()
  })

  it('initializes from the actual stored annual interval without marking monthly as current', async () => {
    mockSite.billing.billing_interval = 'year'
    render(<BillingForm />)
    expect(screen.getByRole('tab', { name: /Annual/ })).toHaveAttribute('aria-selected', 'true')
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Monthly' }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('button', { name: 'Switch Starter monthly' })).toBeEnabled()
    expect(screen.getByText('Current billing: Annual')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Minimum required plan')).toBeInTheDocument())
  })
  it('submits same-interval upgrades without opening the general portal or writing entitlements', async () => {
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: false, error: 'Payment unavailable' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro monthly' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('proportional credit')
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and pay' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith('site-example', 'foundry', 'user@example.test', 0, 'month'))
    expect(billingService.createPortalSession).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Payment unavailable')
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })
  it('cancels same-interval upgrades without charging', () => {
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro monthly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep current plan' }))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
  })
  it('directs pending upgrade payments to Stripe without granting access optimistically', async () => {
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: true,
      flow: 'prorated_upgrade', status: 'pending_payment', url: 'https://invoice.stripe.com/i/pay' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro monthly' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and pay' }))
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('Complete your upgrade payment')))
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })
  it('reviews same-interval paid downgrade and never disconnects accounts or writes entitlements', async () => {
    mockSite.billing.plan = 'foundry'
    jest.mocked(countSocialAccounts).mockReturnValue(10)
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Starter monthly' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('end of your current billing period')
    expect(billingService.createPortalSession).not.toHaveBeenCalled()
    expect(disconnectOutstandSocial).not.toHaveBeenCalled(); expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep current plan' }))
  })

  it('confirms an add-on increase through verified subscription checkout, not the portal', async () => {
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: true,
      flow: 'prorated_addon', status: 'paid' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
      'site-example', 'engine', 'user@example.test', 1, 'month'))
    expect(billingService.createPortalSession).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })

  it.each(['month', 'year'])('starts add-on-only checkout on free with the selected %s interval', async interval => {
    mockSite.billing.plan = 'commission'
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({
      success: true, url: 'https://checkout.stripe.com/c/pay/addons', sessionId: 'cs_addons',
    })
    render(<BillingForm />)
    if (interval === 'year') fireEvent.mouseDown(screen.getByRole('tab', { name: /Annual/ }), { button: 0, ctrlKey: false })
    expect(screen.getByText(interval === 'year' ? '$108.00/year' : '$10.00/month')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
      'site-example', 'commission', 'user@example.test', 1, interval))
    expect(mockNavigate).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/addons')
    expect(billingService.createPortalSession).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })

  it('manages existing free add-ons on their stored interval and blocks unsafe plan changes', async () => {
    mockSite.billing.plan = 'commission'
    mockSite.billing.addons_count = 1
    mockSite.billing.billing_interval = 'year'
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: true,
      flow: 'prorated_addon', status: 'paid' })
    render(<BillingForm />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Monthly' }), { button: 0, ctrlKey: false })
    expect(screen.getByRole('button', { name: 'Upgrade to Starter monthly' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Manage billing' })).toBeEnabled()
    expect(screen.getByText('$108.00/year')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Add one add-on' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
      'site-example', 'commission', 'user@example.test', 2, 'year'))
    expect(mockUpdateBilling).not.toHaveBeenCalled()
  })

  it('allows free add-on reductions through the scheduled renewal flow', async () => {
    mockSite.billing.plan = 'commission'
    mockSite.billing.addons_count = 1
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: true,
      flow: 'scheduled_addon_reduction', effectiveAt: '2026-11-08T00:00:00Z' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove one add-on' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith(
      'site-example', 'commission', 'user@example.test', 0, 'month'))
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(disconnectOutstandSocial).not.toHaveBeenCalled()
    expect(disconnectZavuChannel).not.toHaveBeenCalled()
  })

  it('canceling paid downgrade review neither starts checkout nor disconnects connections', async () => {
    mockSite.billing.plan = 'foundry'
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Starter monthly' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Nothing is disconnected')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current plan' }))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(disconnectOutstandSocial).not.toHaveBeenCalled(); expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Minimum required plan')).toBeInTheDocument())
  })
})