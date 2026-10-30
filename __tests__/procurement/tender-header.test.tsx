import { render, screen, within } from '@testing-library/react'
import { TenderHeader } from '@/app/tenders/public-header'

let mockLocale = 'en'
let mockUser: { user_metadata: { avatar_url?: string; picture?: string } } | null = null

jest.mock('next/image', () => jest.requireActual('next/image'))

jest.mock('@/app/components/auth/auth-provider', () => ({
  useAuthContext: () => ({ user: mockUser, isLoading: false }),
}))
jest.mock('@/app/components/commerce/use-commerce-sign-in-href', () => ({
  useCommerceSignInHref: () => ({ href: '/auth', onClick: jest.fn() }),
}))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: mockLocale, setLocale: jest.fn() }),
}))

it.each([undefined, 'buyer-site'])('uses the toolbar MuseoModerno font for the lowercase tender brand (%s)', siteSlug => {
  render(<TenderHeader siteSlug={siteSlug} />)
  const title = screen.getByText('Tenders')
  expect(title).toHaveClass('lowercase')
  expect(title.closest('[data-toolbar-font]')).toHaveAttribute('href', '/marketplace')
  expect(screen.getByRole('search')).toHaveClass('w-2/5', 'absolute', 'hidden', 'md:block')
})

it.each([
  ['en', 'Tenders'],
  ['es', 'Licitaciones'],
  ['fr', 'Appels d’offres'],
  ['de', 'Ausschreibungen'],
  ['ja', '入札'],
])('translates the header title in %s', (locale, label) => {
  mockLocale = locale
  render(<TenderHeader />)
  const title = screen.getByText(label)
  expect(title).toHaveClass('lowercase')
  expect(title.closest('[data-toolbar-font]')).toBeInTheDocument()
})

it.each([
  { avatar_url: '/avatar.png', picture: '/picture.png' },
  { picture: '/picture.png' },
  {},
])('keeps submissions and uses the account avatar when available (%s)', metadata => {
  mockUser = { user_metadata: metadata }
  render(<TenderHeader />)
  expect(screen.getByRole('link', { name: 'My submissions' })).toHaveAttribute('href', '/home/submissions')
  const account = screen.getByRole('link', { name: 'My account' })
  expect(account).toHaveAttribute('href', '/home')
  const avatar = within(account).queryByRole('img')
  if (metadata.avatar_url || metadata.picture) {
    expect(avatar).toHaveAttribute('src', metadata.avatar_url || metadata.picture)
    expect(avatar).toHaveClass('rounded-full')
  } else {
    expect(avatar).not.toBeInTheDocument()
    expect(account.querySelector('svg')).toBeInTheDocument()
  }
})

it('does not show submissions or an account avatar for guests', () => {
  render(<TenderHeader />)
  expect(screen.queryByRole('link', { name: 'My submissions' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'My account' })).not.toBeInTheDocument()
})

afterEach(() => { mockLocale = 'en'; mockUser = null })