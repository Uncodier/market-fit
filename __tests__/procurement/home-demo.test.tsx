import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import HomePage from '@/app/home/page'
import { PortalDemoProvider } from '@/app/home/demo-context'
import { getDemoHomeSummary } from '@/app/home/demo-summary'
import { getBuyerPortalSummary } from '@/app/buyer/actions'
import { toast } from 'sonner'

jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

let user: { id: string } | null = null
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user }) }))
jest.mock('@/app/buyer/actions', () => ({ getBuyerPortalSummary: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key.startsWith('procurement.') ? key : '', locale: 'en' }),
}))

function mount(demo = true) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
    <PortalDemoProvider demo={demo}><HomePage /></PortalDemoProvider>
  </SWRConfig>)
}

beforeEach(() => { jest.clearAllMocks(); user = null })

test.each([null, { id: 'real-account' }])('shows every home section without live requests (user: %j)', account => {
  user = account
  mount()
  expect(screen.getByRole('heading', { name: 'Alex Morgan' })).toBeInTheDocument()
  for (const title of ['Manage your businesses', 'Online purchases', 'Subscriptions', 'Quotations',
    'Courses', 'Tickets', 'Files', 'Passes', 'Upcoming reservations', 'Recent reservations']) {
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  }
  for (const name of ['Technology consultation', 'Product strategy workshop', 'Workspace onboarding', 'Supplier training session']) {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument()
  }
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(toast.info).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Supplier activity/ })).toHaveAttribute('href', '/home/submissions')
  expect(screen.getByRole('link', { name: /Discover tenders/ })).toHaveAttribute('href', '/tenders')
  expect(fetch).not.toHaveBeenCalled()
  expect(getBuyerPortalSummary).not.toHaveBeenCalled()
})

test('enables all home sections and routes fictional reservations to local previews', () => {
  mount()
  for (const [title, href] of [['Online purchases', '/home/orders'], ['Subscriptions', '/home/subscriptions'],
    ['Quotations', '/home/quotes'], ['Courses', '/home/library?subtype=course'], ['Tickets', '/home/library?subtype=ticket'],
    ['Files', '/home/library?subtype=file'], ['Passes', '/home/library?subtype=pass']]) {
    expect(screen.getByRole('heading', { name: title }).closest('a')).toHaveAttribute('href', href)
  }
  expect(document.querySelector('[aria-disabled="true"]')).toBeNull()
  expect(screen.getByRole('heading', { name: 'Technology consultation' }).closest('a'))
    .toHaveAttribute('href', '/home/preview/reservations/demo-reservation-consultation')
  expect(document.querySelector('a[href="/marketplace"]')).toBeInTheDocument()
  expect(document.querySelector('a[href="/projects?manage=1"]')).toBeInTheDocument()
})

test('uses live data outside demo mode rather than filling empty sections with examples', async () => {
  user = { id: 'real-account' }
  jest.mocked(getBuyerPortalSummary).mockResolvedValue({ error: 'Unavailable' })
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: [], opportunities: [], drafts: [] }) } as Response)
  mount(false)
  expect(await screen.findByText('Failed to load account details.')).toBeInTheDocument()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(getBuyerPortalSummary).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Alex Morgan')).not.toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('keeps reservations relative to the preview date and library totals consistent', () => {
  const now = new Date('2032-05-10T12:00:00Z')
  const summary = getDemoHomeSummary(now)
  expect(summary.counts.library).toBe(summary.counts.courses + summary.counts.tickets + summary.counts.files + summary.counts.passes)
  expect(summary.activeReservations.every(row => new Date(row.start_time) > now)).toBe(true)
  expect(summary.recentReservations.every(row => new Date(row.end_time) < now)).toBe(true)
  expect(new Set([...summary.activeReservations, ...summary.recentReservations].map(row => row.id)).size).toBe(4)
})