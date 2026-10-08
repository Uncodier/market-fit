import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { BillingLimitDialog } from '@/app/components/billing/billing-limit-dialog'
import { SubscriptionPlans } from '@/app/components/billing/subscription-plans'
import type { BillingLimitPayload } from '@/lib/billing-limit-errors'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))

const payload: BillingLimitPayload = { kind: 'members', siteId: '11111111-1111-4111-8111-111111111111', current: 5, limit: 5, requiredPlan: 'foundry', canUpgrade: true }

describe('member license upgrade UI', () => {
  beforeEach(() => jest.clearAllMocks())

  it('routes managers to billing with the correct site and minimum required plan without checkout', () => {
    const onOpenChange = jest.fn()
    render(<BillingLimitDialog open onOpenChange={onOpenChange} payload={payload} />)
    expect(screen.getByRole('alertdialog')).toHaveTextContent('5 of 5 member seats')
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade plan' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(push).toHaveBeenCalledWith(`/billing?siteId=${payload.siteId}&requiredPlan=foundry`)
  })

  it('asks unauthorized invitees to contact the owner and never routes to another site billing', () => {
    render(<BillingLimitDialog open onOpenChange={jest.fn()} payload={{ ...payload, canUpgrade: false }} />)
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/Ask the site owner to upgrade/)
    expect(screen.queryByRole('button', { name: 'Upgrade plan' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(push).not.toHaveBeenCalled()
  })

  it('lists per-site 1/5/10/>10 allowances and highlights only the minimum plan with annual pricing intact', () => {
    const onChangePlan = jest.fn()
    const { container } = render(<SubscriptionPlans currentPlan="engine" currentInterval="month" billingInterval="year" requiredPlan="foundry" isSaving={false} onChangePlan={onChangePlan} />)
    for (const [plan, allowance] of [['commission', '1 member per site'], ['engine', '5 members per site'], ['foundry', '10 members per site'], ['enterprise', 'More than 10 members per site']]) {
      expect(container.querySelector(`[data-plan="${plan}"]`)).toHaveTextContent(allowance)
    }
    const required = container.querySelector('[data-required-plan="true"]') as HTMLElement
    expect(required).toHaveAttribute('data-plan', 'foundry')
    expect(required).toHaveClass('bg-primary/5')
    expect(required).not.toHaveClass('ring-1', 'ring-primary')
    expect(within(required).queryByRole('img', { name: 'Selected plan' })).not.toBeInTheDocument()
    expect(within(required).getByText('Minimum required plan')).toBeInTheDocument()
    expect(screen.getAllByText('Minimum required plan')).toHaveLength(1)
    for (const price of ['$248.40', '$1,069.20', '$5,400.00']) expect(screen.getByText(price)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Switch Starter annual' }))
    expect(onChangePlan).toHaveBeenCalledWith('engine')
  })
})