import { render, screen } from '@testing-library/react'
import { SettingsFormSkeleton } from '@/app/settings/settings-form-skeleton'
import { SettingsCardsLoading, VisitsSettingsLoading } from '@/app/components/settings/settings-loading'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))

function sections(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-settings-section]')).map(element => element.getAttribute('data-settings-section'))
}

test('general preserves the logo, three stacked inputs, resource rows and footer-free danger zone', () => {
  const { container } = render(<SettingsFormSkeleton />)
  expect(sections(container)).toEqual(['site-information', 'web-resources', 'site-danger-zone'])
  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('space-y-12')
  const site = container.querySelector('[data-settings-section="site-information"]')!
  expect(site.querySelector('.h-60.w-60')).not.toBeNull()
  expect(site.querySelectorAll('.h-12.w-full')).toHaveLength(3)
  expect(container.querySelector('[data-settings-section="site-danger-zone"] .border-t')).toBeNull()
})

test('company includes each location group, business hours, four goals and four SWOT cards', () => {
  const { container } = render(<SettingsFormSkeleton segment="company" />)
  expect(sections(container)).toEqual([
    'company-profile', 'office-locations', 'office-locations-0',
    'service-available-restrictions', 'service-available-restrictions-0',
    'service-exclusions-addresses', 'service-exclusions-addresses-0',
    'business-hours', 'business-hours-0',
    'goals-quarterly', 'goals-yearly', 'goals-five-year', 'goals-ten-year',
    'swot-strengths', 'swot-weaknesses', 'swot-opportunities', 'swot-threats',
  ])
  expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('space-y-4')
  expect(container.querySelectorAll('[data-skeleton-shape="text"]')).toHaveLength(8)
  expect(container.querySelectorAll('[data-skeleton-shape="summary"] .border-t')).toHaveLength(0)
  expect(container.querySelectorAll('[data-settings-section="company-profile"] .h-10.w-full')).toHaveLength(3)
})

test('marketplace starts with share/QR and includes all five settings cards', () => {
  const { container } = render(<SettingsFormSkeleton segment="marketplace" />)
  expect(sections(container)).toEqual(['shop-share', 'shop-hero', 'shop-trust', 'shop-payouts', 'shop-payments', 'shop-self-service'])
  expect(container.querySelector('[data-settings-section="shop-share"] .md\\:flex-row')).not.toBeNull()
  expect(container.querySelector('[data-settings-section="shop-hero"] .aspect-video')).not.toBeNull()
  expect(container.querySelectorAll('[data-settings-section="shop-payouts"] .h-10.w-full')).toHaveLength(4)
})

test('secrets retains its four-column table and never becomes a generic list card', () => {
  const { container } = render(<SettingsFormSkeleton segment="secrets" />)
  expect(container.querySelectorAll('thead th')).toHaveLength(4)
  expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  container.querySelectorAll('tbody tr').forEach(row => expect(row.querySelectorAll('td')).toHaveLength(4))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(container.querySelector('[data-skeleton-shape="list"]')).toBeNull()
})

test('route and in-page visits share the same card content and section-card padding', () => {
  const route = render(<SettingsFormSkeleton segment="visits" />)
  const routeCards = route.container.querySelector('[aria-hidden="true"]')!.innerHTML
  route.unmount()
  const inPage = render(<VisitsSettingsLoading />)
  expect(inPage.container.querySelector('[aria-hidden="true"]')!.innerHTML).toBe(routeCards)
  expect(inPage.container.querySelectorAll('.h-6.w-11')).toHaveLength(5)
  const terms = inPage.container.querySelector('[data-settings-section="visits-terms"]')!
  expect(terms.querySelector('.h-64.w-full')?.parentElement).toHaveClass('px-5', 'pb-5', 'pt-0')
  // The real terms textarea has no additional field label inside its content.
  expect(terms.querySelector('.h-4.w-28')).toBeNull()
  expect(terms.querySelector('.border-t')).toHaveClass('px-5', 'py-3')
})

test('team reuses member detail skeletons without nested loading announcements', () => {
  const route = render(<SettingsFormSkeleton segment="team" />)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  const cards = Array.from(route.container.querySelectorAll('[data-skeleton-shape="list"]')).map(card => card.innerHTML)
  route.unmount()
  const inPage = render(<SettingsCardsLoading kind="team" />)
  expect(Array.from(inPage.container.querySelectorAll('[data-skeleton-shape="list"]')).map(card => card.innerHTML)).toEqual(cards)
  expect(inPage.container.querySelectorAll('[data-team-detail-fields]')).toHaveLength(2)
  expect(inPage.container.querySelectorAll('[data-team-role-tabs]')).toHaveLength(2)
  expect(inPage.container.querySelectorAll('.p-6')).toHaveLength(0)
})

test.each(['calendar', 'social', 'printers'])('%s uses collapsed summaries without invented save footers', segment => {
  const { container } = render(<SettingsFormSkeleton segment={segment} />)
  expect(container.querySelectorAll('[data-skeleton-shape="summary"]')).toHaveLength(2)
  expect(container.querySelectorAll('.border-t')).toHaveLength(0)
})

test('legacy activities include Due Invoices and all ten cards, with ICP always-active content', () => {
  const { container } = render(<SettingsFormSkeleton segment="activities" />)
  expect(container.querySelectorAll('[data-skeleton-shape="activity"]')).toHaveLength(10)
  expect(container.querySelector('[data-settings-section="activity-invoices_due"]')).not.toBeNull()
  expect(container.querySelector('[data-settings-section="activity-icp_lead_generation"] .flex-wrap')).toBeNull()
})