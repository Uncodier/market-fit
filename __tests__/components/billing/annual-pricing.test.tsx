import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SubscriptionPlans } from '@/app/components/billing/subscription-plans'
import { ConnectedAccountsAddons } from '@/app/components/billing/connected-accounts-addons'
import { BillingIntervalSelector } from '@/app/components/billing/billing-interval-selector'
import { formatPrice, subscriptionPrice } from '@/lib/billing-pricing'
import { preferredBillingInterval, rememberBillingInterval } from '@/lib/billing-interval-preference'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

describe('billing interval selection', () => {
  beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/') })

  it('allows the same plan on another interval and keeps only exact plan+interval current', () => {
    const onChange = jest.fn()
    const { rerender } = render(<SubscriptionPlans currentPlan="engine" currentInterval="month" billingInterval="year" isSaving={false} onChangePlan={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch Starter annual' }))
    expect(onChange).toHaveBeenCalledWith('engine')
    for (const price of ['$248.40', '$1,069.20', '$5,400.00']) expect(screen.getByText(price)).toBeInTheDocument()
    expect(screen.getByText(/20 credits\/month/)).toBeInTheDocument()
    rerender(<SubscriptionPlans currentPlan="engine" currentInterval="year" billingInterval="year" isSaving={false} onChangePlan={onChange} />)
    expect(screen.queryByRole('button', { name: 'Switch Starter annual' })).not.toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('defaults to monthly and disables actions while saving', () => {
    const onChange = jest.fn()
    render(<SubscriptionPlans currentPlan="commission" isSaving onChangePlan={onChange} />)
    expect(screen.getByText('$23.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upgrade to Starter monthly' })).toBeDisabled()
    render(<BillingIntervalSelector value="month" onChange={onChange} disabled />)
    const monthly = screen.getByRole('tab', { name: 'Monthly' })
    const annual = screen.getByRole('tab', { name: /Annual/ })
    expect(monthly).toBeDisabled()
    expect(annual).toBeDisabled()
    fireEvent.mouseDown(annual, { button: 0, ctrlKey: false })
    fireEvent.keyDown(annual, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('renders controlled interval tabs and reports the selected interval without submitting', () => {
    const onChange = jest.fn()
    const { rerender } = render(<BillingIntervalSelector value="month" onChange={onChange} disabled={false} />)
    expect(screen.getByRole('tablist', { name: 'Billing interval' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    const monthly = screen.getByRole('tab', { name: 'Monthly' })
    const annual = screen.getByRole('tab', { name: 'Annual — save 10%' })
    expect(monthly).toHaveAttribute('aria-selected', 'true')
    expect(annual).toHaveAttribute('aria-selected', 'false')
    expect(annual).toHaveAttribute('type', 'button')
    fireEvent.mouseDown(annual, { button: 0, ctrlKey: false })
    expect(onChange).toHaveBeenCalledWith('year')
    expect(monthly).toHaveAttribute('aria-selected', 'true')
    rerender(<BillingIntervalSelector value="year" onChange={onChange} disabled={false} />)
    expect(annual).toHaveAttribute('aria-selected', 'true')
    expect(monthly).toHaveAttribute('aria-selected', 'false')
    fireEvent.mouseDown(monthly, { button: 0, ctrlKey: false })
    expect(onChange).toHaveBeenLastCalledWith('month')
  })

  it('supports keyboard navigation between interval tabs', async () => {
    const onChange = jest.fn()
    render(<BillingIntervalSelector value="month" onChange={onChange} disabled={false} />)
    const monthly = screen.getByRole('tab', { name: 'Monthly' })
    const annual = screen.getByRole('tab', { name: /Annual/ })
    fireEvent.keyDown(monthly, { key: 'ArrowRight' })
    await waitFor(() => {
      expect(annual).toHaveFocus()
      expect(onChange).toHaveBeenCalledWith('year')
    })
    fireEvent.keyDown(annual, { key: 'ArrowLeft' })
    await waitFor(() => expect(monthly).toHaveFocus())
  })

  it('shows current annual addon total and keeps monthly credits', () => {
    render(<ConnectedAccountsAddons totalSocialAccounts={4} totalAgentChannels={1} socialLimit={3} agentLimit={1} addonsCount={2} billingInterval="year" requiredAddons={1} missingAddons={0} socialUsagePercentage={80} agentUsagePercentage={100} isPaidPlan isSaving={false} onManageAddons={jest.fn()} />)
    expect(screen.getByText(/Each add-on costs \$108.00\/year.*\$9.00\/month equivalent.*\+5 credits\/month/)).toBeInTheDocument()
    expect(screen.getByText('$216.00/year total · $18.00/month equivalent')).toBeInTheDocument()
  })

  it('does not advertise unsupported paid interval changes for existing addon subscriptions', () => {
    render(<SubscriptionPlans currentPlan="engine" currentInterval="month" billingInterval="year" isSaving={false} blockedPaidChanges onChangePlan={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Switch Starter annual' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro annual' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Downgrade to Toolbox monthly' })).toBeEnabled()
  })

  it('labels unsupported same-interval tier changes as management, not checkout upgrades', () => {
    const onChange = jest.fn()
    render(<SubscriptionPlans currentPlan="engine" currentInterval="month" billingInterval="month" isSaving={false} onChangePlan={onChange} />)
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro monthly' })).not.toBeInTheDocument()
    const manage = screen.getByRole('button', { name: 'Manage Pro monthly in Stripe' })
    expect(manage).toHaveTextContent('Manage')
    fireEvent.click(manage)
    expect(onChange).toHaveBeenCalledWith('foundry')
  })

  it('honors only validated display preferences and URL intent without charging', () => {
    expect(preferredBillingInterval('month')).toBe('month')
    rememberBillingInterval('year')
    expect(preferredBillingInterval('month')).toBe('year')
    rememberBillingInterval('invalid')
    expect(preferredBillingInterval('month')).toBe('year')
    window.history.replaceState({}, '', '/billing?billingInterval=month')
    expect(preferredBillingInterval('year')).toBe('month')
  })

  it.each([[23, '$248.40'], [99, '$1,069.20'], [500, '$5,400.00'], [10, '$108.00']])('formats discounted yearly pricing for %s', (monthly, annual) => {
    expect(formatPrice(subscriptionPrice(monthly as number, 'year').total)).toBe(annual)
  })
})