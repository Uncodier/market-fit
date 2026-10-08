import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BillingForm } from '@/app/components/billing/billing-form'
import { billingService } from '@/app/services/billing-service'
import { toast } from 'sonner'
import { disconnectOutstandSocial, disconnectZavuChannel } from '@/app/components/settings/disconnect-remote-accounts'
import { countSocialAccounts } from '@/lib/billing-limits'

const mockUpdateBilling = jest.fn()
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
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))
jest.mock('@/lib/billing-limits', () => ({ countSocialAccounts: jest.fn(() => 0), countAgentChannels: () => 0, getSocialAccountLimit: () => 3, getAgentChannelLimit: () => 1, getRequiredAddons: () => 0 }))
jest.mock('@/app/components/billing/stripe-payment-method', () => ({ StripePaymentMethod: () => null }))
jest.mock('@/app/components/billing/purchase-credits-dialog', () => ({ PurchaseCreditsDialog: () => null }))
jest.mock('@/app/components/billing/downgrade-channels-modal', () => ({ DowngradeChannelsModal: () => null }))
jest.mock('@/app/components/settings/disconnect-remote-accounts', () => ({ disconnectOutstandSocial: jest.fn(), disconnectZavuChannel: jest.fn() }))

describe('billing form interval contract', () => {
  beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); window.history.replaceState({}, '', '/billing'); mockSite.billing.plan = 'engine'; mockSite.billing.billing_interval = 'month'; jest.mocked(countSocialAccounts).mockReturnValue(0) })

  it('reviews paid downgrades without disconnecting providers before Stripe confirmation', async () => {
    mockSite.billing.plan = 'foundry'
    jest.mocked(countSocialAccounts).mockReturnValue(6)
    jest.mocked(billingService.createSubscriptionCheckoutSession).mockResolvedValue({ success: false, error: 'Confirmation unavailable' })
    render(<BillingForm />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Annual/ }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Starter annual' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('suspended, not deleted')
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Review in Stripe' }))
    await waitFor(() => expect(billingService.createSubscriptionCheckoutSession).toHaveBeenCalledWith('site-example', 'engine', 'user@example.test', 0, 'year'))
    expect(disconnectOutstandSocial).not.toHaveBeenCalled()
    expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Confirmation unavailable')
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

  it('routes same-interval tier changes to management and surfaces portal rejection without checkout', async () => {
    jest.mocked(billingService.createPortalSession).mockResolvedValue({ success: false, error: 'Portal transition unavailable' })
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage Pro monthly in Stripe' }))
    await waitFor(() => expect(billingService.createPortalSession).toHaveBeenCalledWith('site-example', window.location.href))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Portal transition unavailable')
  })

  it('failed same-interval paid downgrade does not disconnect accounts or write entitlements', async () => {
    mockSite.billing.plan = 'foundry'
    jest.mocked(countSocialAccounts).mockReturnValue(10)
    jest.mocked(billingService.createPortalSession).mockRejectedValue(new Error('Portal rejected'))
    render(<BillingForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Manage Starter monthly in Stripe' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('An error occurred'))
    expect(disconnectOutstandSocial).not.toHaveBeenCalled(); expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
  })

  it('canceling paid downgrade review neither starts checkout nor disconnects connections', async () => {
    mockSite.billing.plan = 'foundry'
    render(<BillingForm />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Annual/ }), { button: 0, ctrlKey: false })
    fireEvent.click(screen.getByRole('button', { name: 'Downgrade to Starter annual' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Nothing is disconnected')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current plan' }))
    expect(billingService.createSubscriptionCheckoutSession).not.toHaveBeenCalled()
    expect(disconnectOutstandSocial).not.toHaveBeenCalled(); expect(disconnectZavuChannel).not.toHaveBeenCalled()
    expect(mockUpdateBilling).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Minimum required plan')).toBeInTheDocument())
  })
})