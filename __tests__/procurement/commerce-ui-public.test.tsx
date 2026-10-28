import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TenderDirectory } from '@/app/tenders/directory'
import { loadPublicTenders, participationClosed } from '@/app/tenders/public-data'
import PublicDetail from '@/app/tenders/[siteSlug]/[tenderSlug]/page'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useRouter } from 'next/navigation'

jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: jest.fn(() => ({ user: null, isLoading: false })) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/tenders/public-data', () => ({ loadPublicTenders: jest.fn(), participationClosed: jest.fn(() => true) }))
jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: ({ primaryActions }: { primaryActions?: ReactNode }) => <header data-testid="commerce-header">Public tenders{primaryActions}</header>, TenderFooter: () => <footer>Public information</footer> }))
beforeEach(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
  jest.mocked(participationClosed).mockReturnValue(true)
  jest.mocked(useAuthContext).mockReturnValue({ user: null, isLoading: false } as never)
})

const publication = { publication_id: 'publication', site_slug: 'buyer-workspace', tender_slug: 'tender', version: 2, status: 'closed',
  snapshot: { title: 'Maintenance services', description: 'Published scope', requirements: [{ id: 'line', description: 'Inspect equipment', quantity: 1, unit: 'service' }],
    participation_deadline: '2026-10-01T00:00:00Z', opening_at: '2026-10-02T00:00:00Z', participation: 'public', opening_policy: 'after_deadline' } }

it('renders published opportunity cards with real document navigation, not checkout', async () => {
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [publication], error: null } as never)
  render(await TenderDirectory({ page: 0, search: 'maintenance' }))
  expect(loadPublicTenders).toHaveBeenCalledWith(undefined, undefined, 0, 'maintenance')
  expect(screen.getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/tenders/buyer-workspace/tender')
  expect(screen.queryByText(/checkout|add to cart/i)).not.toBeInTheDocument()
})

it('keeps closed public documents readable without offering submission', async () => {
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [publication], error: null } as never)
  render(await PublicDetail({ params: Promise.resolve({ siteSlug: 'buyer-workspace', tenderSlug: 'tender' }) }))
  expect(screen.getByText('Inspect equipment')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Submit proposal' })).not.toBeInTheDocument()
})

it('places the open publication proposal action only in the commerce header', async () => {
  jest.mocked(participationClosed).mockReturnValue(false)
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [publication], error: null } as never)
  render(await PublicDetail({ params: Promise.resolve({ siteSlug: 'buyer-workspace', tenderSlug: 'tender' }) }))
  const action = screen.getByRole('link', { name: 'Submit proposal' })
  expect(screen.getByTestId('commerce-header')).toContainElement(action)
  expect(action).toHaveAttribute('href', '/home/submissions?publication=publication')
  expect(screen.getByRole('main')).not.toContainElement(action)
})

it('filters only actual publications and explains the current-page scope', async () => {
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [publication], error: null } as never)
  render(await TenderDirectory({ page: 0, search: '' }))
  fireEvent.click(screen.getAllByRole('button', { name: 'Participation open' })[0])
  expect(screen.queryByRole('link', { name: 'View tender' })).not.toBeInTheDocument()
  expect(screen.getByText('No publications match this participation filter.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show all publications on this page' }))
  expect(screen.getByRole('link', { name: 'View tender' })).toBeInTheDocument()
  expect(screen.getByTitle('Sort this page')).toBeInTheDocument()
})

it('composes actual public commerce shell and search without cart hooks', () => {
  const source = readFileSync(join(process.cwd(), 'app/tenders/public-header.tsx'), 'utf8')
  expect(source).toContain('<CommerceShellHeader')
  expect(source).toContain('<CommerceSearchInput')
  expect(source).not.toMatch(/CartButton|useCart|checkout/)
})

it('renders the real Makinari header with proposal action and secondary authenticated navigation', () => {
  const { TenderHeader } = jest.requireActual<typeof import('@/app/tenders/public-header')>('@/app/tenders/public-header')
  jest.mocked(useAuthContext).mockReturnValue({ user: { id: 'account' }, isLoading: false } as never)
  render(<TenderHeader primaryActions={<a href="/home/submissions?publication=publication">Submit proposal</a>} />)
  expect(screen.getByRole('link', { name: 'Makinari marketplace' })).toHaveAttribute('href', '/marketplace')
  expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/home')
  expect(screen.getByRole('link', { name: 'My submissions' })).not.toHaveClass('btn-primary')
  expect(screen.getByRole('link', { name: 'Submit proposal' }).closest('[data-commerce-shell-header]')).not.toBeNull()
  expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
})

it('keeps mobile search inside the commerce header and bounds query input', () => {
  const { TenderHeader } = jest.requireActual<typeof import('@/app/tenders/public-header')>('@/app/tenders/public-header')
  render(<TenderHeader siteSlug="buyer-workspace" />)
  fireEvent.click(screen.getByRole('button', { name: 'Search published tenders' }))
  const input = screen.getAllByPlaceholderText('Search published tenders')[0]
  fireEvent.change(input, { target: { value: 'maintenance' } })
  const form = input.closest('form')
  expect(form).toHaveAttribute('action', '/tenders/buyer-workspace')
  expect(form?.querySelector('input[name="search"]')).toHaveValue('maintenance')
  expect(form?.closest('[data-commerce-shell-header]')).not.toBeNull()
  const router = jest.mocked(useRouter).mock.results.at(-1)?.value
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(router.push).toHaveBeenCalledWith('/tenders/buyer-workspace?search=maintenance')
})

it('shows a recoverable error instead of the empty publication state', async () => {
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [], error: 'Publications unavailable' })
  render(await TenderDirectory({ page: 0, search: '' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Publications unavailable')
  expect(screen.getByRole('link', { name: 'Retry' })).toHaveAttribute('href', '/tenders?page=0&search=')
  expect(screen.queryByText('No published tenders match this view.')).not.toBeInTheDocument()
})

it('uses the shared empty state with a search recovery action', async () => {
  jest.mocked(loadPublicTenders).mockResolvedValue({ rows: [], error: null })
  render(await TenderDirectory({ page: 0, search: 'unmatched' }))
  expect(screen.getByRole('heading', { name: 'No published tenders match this view.' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Clear search' })).toHaveAttribute('href', '/tenders')
})