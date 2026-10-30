import { render, screen } from '@testing-library/react'
import { SettingsFormSkeleton } from '@/app/settings/settings-form-skeleton'
import ProcurementLoading from '@/app/settings/procurement/loading'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))

test.each(['general', 'company', 'marketplace', 'visits', 'team', 'channels', 'social', 'calendar', 'secrets', 'printers', 'activities', 'tenders'])(
  '%s loading is a shaped, non-interactive skeleton with no visible loading text', segment => {
    const { container } = render(<SettingsFormSkeleton segment={segment} />)
    expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5)
    expect(container.querySelectorAll('button,input,textarea,select')).toHaveLength(0)
    expect(container.textContent).toBe('')
    expect(container.querySelector('header')).toBeNull()
  },
)

test('each selected section has appropriate shapes instead of rendering all Settings at once', () => {
  const view = render(<SettingsFormSkeleton segment="team" />)
  expect(view.container.querySelectorAll('[data-skeleton-shape="list"]')).toHaveLength(2)
  expect(view.container.querySelector('[data-skeleton-shape="hero"]')).toBeNull()
  view.rerender(<SettingsFormSkeleton segment="marketplace" />)
  expect(view.container.querySelector('[data-skeleton-shape="hero"]')).not.toBeNull()
  view.rerender(<SettingsFormSkeleton segment="tenders" />)
  expect(view.container.querySelectorAll('[data-portal-settings-skeleton]')).toHaveLength(1)
  expect(view.container.querySelectorAll('[data-policy-settings-skeleton]')).toHaveLength(3)
})

test('procurement route fallback has form cards without another sticky header', () => {
  const { container } = render(<ProcurementLoading />)
  expect(container.querySelector('[data-procurement-settings-skeleton]')).not.toBeNull()
  expect(container.querySelector('header')).toBeNull()
  expect(container.textContent).toBe('')
})