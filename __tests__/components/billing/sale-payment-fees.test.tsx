import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { SubscriptionPlans } from '@/app/components/billing/subscription-plans'
import { BillingSection } from '@/app/components/settings/BillingSection'
import { LocalizationProvider, type SupportedLocale } from '@/app/context/LocalizationContext'
import { flattenMessages } from '@/app/context/locale-messages'
import en from '@/app/context/locales/en.json'
import es from '@/app/context/locales/es.json'
import fr from '@/app/context/locales/fr.json'
import de from '@/app/context/locales/de.json'
import ja from '@/app/context/locales/ja.json'
import {
  SALE_PAYMENT_FEE_BASIS_POINTS,
  normalizeSalePaymentFeePlan,
  salePaymentFeePercent,
} from '@/lib/sale-payment-fees'

jest.mock('@/app/context/PermissionContext', () => ({ useOptionalPermissions: () => null }))
jest.mock('@/app/components/ui/use-btn-glass-motion', () => ({ useBtnGlassMotion: () => () => undefined }))

let mockCurrentSite: {
  billing?: { plan?: unknown; billing_interval?: string } | null
  billing_read_status?: string
} | null
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockCurrentSite }) }))

const dictionaries = { en, es, fr, de, ja }
const rates = [
  ['commission', 7], ['engine', 6], ['foundry', 5.5], ['enterprise', 4.5],
] as const
const label = (percent: number) => `Card payment fee: ${percent}% · processing included`
const renderLocalized = (children: React.ReactNode, locale: SupportedLocale = 'en') => render(
  <LocalizationProvider preferredLocale={locale}>{children}</LocalizationProvider>
)

beforeEach(() => {
  mockCurrentSite = { billing: { plan: 'engine', billing_interval: 'month' } }
})

describe('display-only card payment fee policy', () => {
  it('keeps the four rates immutable and expressed in basis points', () => {
    expect(SALE_PAYMENT_FEE_BASIS_POINTS).toEqual({
      commission: 700, engine: 600, foundry: 550, enterprise: 450,
    })
    expect(Object.isFrozen(SALE_PAYMENT_FEE_BASIS_POINTS)).toBe(true)
  })

  it.each(rates)('displays the %s rate as %s percent', (plan, percent) => {
    expect(salePaymentFeePercent(plan)).toBe(percent)
  })

  it.each([undefined, null, '', 'unknown', 'starter', 'startup', 'reactor', 'Enterprise', ' engine ', 123])(
    'uses 7 percent for unrecognized or missing plan %s without claiming a verified plan', plan => {
      expect(salePaymentFeePercent(plan)).toBe(7)
      expect(normalizeSalePaymentFeePlan(plan)).toBeNull()
    }
  )

  it('keeps the free display alias at the commission rate', () => {
    expect(salePaymentFeePercent('free')).toBe(7)
    expect(normalizeSalePaymentFeePlan('free')).toBe('commission')
  })
})

describe('subscription plan payment fees', () => {
  it.each(['month', 'year'] as const)('shows all four rates with %s billing without changing prices or allowances', interval => {
    const { container } = renderLocalized(<SubscriptionPlans currentPlan="commission" billingInterval={interval}
      isSaving={false} onChangePlan={jest.fn()} />)
    for (const [plan, percent] of rates) {
      const card = within(container.querySelector(`[data-plan="${plan}"]`) as HTMLElement)
      expect(card.getByText(label(percent))).toBeVisible()
      expect(card.getAllByText(/Card payment fee:/)).toHaveLength(1)
    }
    const prices = interval === 'month'
      ? ['$0.00', '$23.00', '$99.00', '$500.00']
      : ['$0.00', '$248.40', '$1,069.20', '$5,400.00']
    for (const price of prices) expect(screen.getByText(price)).toBeVisible()
    for (const credits of [1, 20, 100, 500]) {
      expect(screen.getByText(new RegExp(`^${credits} credits?/month`))).toBeVisible()
    }
    expect(screen.getByText(/Rates are for standard card payments/)).toHaveTextContent(
      '4.5% is not guaranteed to cover processing costs for international payments, currency conversion or small payments.'
    )
  })

  it('leaves payment rates unchanged when switching monthly to annual billing', () => {
    const plans = (billingInterval: 'month' | 'year') => <LocalizationProvider preferredLocale="en">
      <SubscriptionPlans currentPlan="engine" billingInterval={billingInterval} isSaving={false} onChangePlan={jest.fn()} />
    </LocalizationProvider>
    const { rerender } = render(plans('month'))
    const monthlyLabels = screen.getAllByText(/^Card payment fee:/).map(node => node.textContent)
    rerender(plans('year'))
    expect(screen.getAllByText(/^Card payment fee:/).map(node => node.textContent)).toEqual(monthlyLabels)
  })
})

describe('settings current site payment fee', () => {
  it.each(rates)('shows the current %s site rate of %s percent', (plan, percent) => {
    mockCurrentSite = { billing: { plan, billing_interval: 'month' }, billing_read_status: 'loaded' }
    renderLocalized(<BillingSection />)
    expect(screen.getByText(label(percent))).toBeVisible()
    expect(screen.queryByText(/^Default card payment fee:/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage billing' })).toHaveAttribute('href', '/billing')
  })

  it('uses the current site rather than a previous site or billing interval', () => {
    const section = <LocalizationProvider preferredLocale="en"><BillingSection /></LocalizationProvider>
    const { rerender } = render(section)
    expect(screen.getByText(label(6))).toBeVisible()
    mockCurrentSite = { billing: { plan: 'enterprise', billing_interval: 'year' } }
    rerender(<LocalizationProvider preferredLocale="en"><BillingSection /></LocalizationProvider>)
    expect(screen.getByText(label(4.5))).toBeVisible()
    expect(screen.queryByText(label(6))).not.toBeInTheDocument()
    mockCurrentSite = { billing: { plan: 'enterprise', billing_interval: 'month' } }
    rerender(<LocalizationProvider preferredLocale="en"><BillingSection /></LocalizationProvider>)
    expect(screen.getByText(label(4.5))).toBeVisible()
  })

  it.each([
    null, {}, { billing: null }, { billing: { plan: null } }, { billing: { plan: 'unknown' } },
    { billing: { plan: 'starter' } }, { billing: { plan: 'enterprise' }, billing_read_status: 'unavailable' },
  ])('labels the default rate honestly when the current plan is unavailable (%j)', site => {
    mockCurrentSite = site
    renderLocalized(<BillingSection />)
    expect(screen.getByText('Default card payment fee: 7% · processing included · current plan unavailable')).toBeVisible()
    expect(screen.getByText('Current plan unavailable')).toBeVisible()
    expect(screen.queryByText(/^Current plan:/)).not.toBeInTheDocument()
    expect(screen.queryByText(label(4.5))).not.toBeInTheDocument()
  })
})

describe('supported billing locale messages', () => {
  it.each(Object.keys(dictionaries) as SupportedLocale[])('has explicit consistent fee keys in %s with the real locale provider', locale => {
    const messages = flattenMessages(dictionaries[locale])
    const english = flattenMessages(en)
    const keys = Object.keys(english).filter(key => key.startsWith('billing.salePaymentFee.'))
    for (const key of keys) {
      expect(messages[key]).toEqual(expect.any(String))
      expect(messages[key]).not.toBe(key)
      expect(messages[key].match(/\{\{\w+\}\}/g)).toEqual(english[key].match(/\{\{\w+\}\}/g))
      if (locale !== 'en') expect(messages[key]).not.toBe(english[key])
    }
    mockCurrentSite = null
    const { container } = renderLocalized(<>
      <SubscriptionPlans currentPlan="commission" isSaving={false} onChangePlan={jest.fn()} />
      <BillingSection />
    </>, locale)
    expect(screen.getByText(messages['billing.salePaymentFee.defaultLabel'].replace('{{percent}}', '7'))).toBeVisible()
    for (const [, percent] of rates) {
      expect(screen.getByText(messages['billing.salePaymentFee.label'].replace('{{percent}}', String(percent)))).toBeVisible()
    }
    expect(screen.getAllByText(messages['billing.salePaymentFee.notice'].replace('{{percent}}', '4.5'))).toHaveLength(2)
    expect(container.textContent).not.toMatch(/billing\.salePaymentFee\.|\{\{percent\}\}/)
  })
})