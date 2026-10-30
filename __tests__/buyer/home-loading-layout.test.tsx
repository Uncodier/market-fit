import { render, screen } from '@testing-library/react'
import HomeLoading from '@/app/home/loading'
import ProfileLoading from '@/app/home/profile/loading'
import SubmissionsLoading from '@/app/home/submissions/loading'
import { CredentialsSkeleton } from '@/app/home/portal-skeletons'
import { BuyerHomeView } from '@/app/buyer/components/BuyerHomeView'
import { getDemoHomeSummary } from '@/app/home/demo-summary'

jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ locale: 'en', t: (key: string) => key.startsWith('procurement.') ? key : '' }),
}))
jest.mock('@/app/buyer/actions', () => ({ getBuyerPortalSummary: jest.fn() }))
jest.mock('swr', () => ({ __esModule: true, default: () => ({ isLoading: true }) }))

test('home boundary uses the same profile header, card grid and padding as the settled screen', () => {
  const { container, unmount } = render(<HomeLoading />)
  const status = screen.getByRole('status', { name: 'Loading content' })
  expect(status).toHaveAttribute('aria-busy', 'true')
  expect(status).toHaveClass('gap-8', 'py-4', 'md:py-8', 'px-4')
  expect(container.querySelector('.h-16.w-16.rounded-full')).not.toBeNull()
  const grid = container.querySelector('[aria-hidden="true"].grid')!
  expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4')
  expect(container.querySelectorAll('[data-home-card-skeleton]')).toHaveLength(6)
  expect(container.querySelector('table')).toBeNull()
  unmount()
  const settled = render(<BuyerHomeView demoSummary={getDemoHomeSummary()} />)
  expect(settled.container.firstChild).toHaveClass('gap-8', 'py-4', 'md:py-8', 'px-4')
  expect(settled.container.querySelector('.grid.lg\\:grid-cols-3')).toHaveClass(...grid.className.split(' '))
})

test('summary fetch uses the home skeleton instead of rendering incomplete navigation', () => {
  render(<BuyerHomeView additionalCards={[{ title: 'Credentials', description: 'Documents', icon: null, href: '/home/profile' }]} />)
  expect(screen.getByRole('status')).toHaveAttribute('data-account-skeleton', 'home')
  expect(document.querySelectorAll('[data-home-card-skeleton]')).toHaveLength(3)
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('submissions has its own non-sticky toolbar, invitation heading and four-column table', () => {
  const { container } = render(<SubmissionsLoading />)
  expect(screen.getByRole('status')).toHaveAttribute('data-account-skeleton', 'submissions')
  expect(container.querySelector('.min-h-\\[72px\\]')).not.toBeNull()
  expect(container.querySelectorAll('thead th')).toHaveLength(4)
  expect(container.querySelectorAll('tbody tr')).toHaveLength(4)
  expect(container.querySelector('.sticky')).toBeNull()
})

test('credential content loading does not repeat the already-rendered page header', () => {
  const { container } = render(<CredentialsSkeleton contentOnly />)
  expect(screen.getByRole('status')).toHaveAttribute('data-account-skeleton', 'credentials')
  expect(container.querySelector('table')).toBeInTheDocument()
  expect(container.querySelector('.bg-muted\\/30')).toBeNull()
})

test('profile boundary contains the centered account profile followed by credential revisions', () => {
  const { container } = render(<ProfileLoading />)
  expect(container.querySelector('[data-account-skeleton="profile"]')).toHaveClass('max-w-2xl', 'mx-auto')
  expect(container.querySelector('.h-24.w-24.rounded-full')).not.toBeNull()
  expect(container.querySelector('[data-account-skeleton="credentials"] table')).toBeInTheDocument()
})