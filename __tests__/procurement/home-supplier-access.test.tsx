import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import HomePage from '@/app/home/page'
import type { Opportunity } from '@/app/home/submissions/types'

let user: { id: string } | null = { id: 'account' }
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user }) }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string) => key, locale: 'en' }),
}))
jest.mock('@/app/buyer/components/BuyerHomeView', () => ({
  BuyerHomeView: ({ additionalCards }: { additionalCards: { title: string; href: string; icon: ReactNode }[] }) =>
    <nav>{additionalCards.map(card => <a key={card.href} href={card.href}>{card.icon}{card.title}</a>)}</nav>,
}))

const invitation: Opportunity = {
  site_id: 'buyer', supplier_id: 'supplier', supplier_name: 'Invited supplier',
  acting_as_self: false, directly_invited: true, tender_id: 'tender', publication_id: 'publication', version: 1,
  title: 'Invited tender', description: '', currency: 'USD', visibility: 'private', participation: 'invitation_only',
  participation_deadline: '2030-01-01T00:00:00Z', opening_at: '2030-01-02T00:00:00Z',
  opening_policy: 'after_close', requirements: [],
}
const response = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response
function mount() {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
    <HomePage />
  </SWRConfig>)
}
function serve(opportunities: Opportunity[] = [], submissions: unknown[] = [], drafts: unknown[] = []) {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/participation')
    ? response({ opportunities }) : String(url).includes('/drafts/list')
      ? response({ drafts }) : response({ data: submissions }))
}
const activity = () => screen.queryByRole('link', { name: 'Supplier activity' })
beforeEach(() => { jest.clearAllMocks(); user = { id: 'account' } })

test.each(['invitation_only', 'approved_suppliers'])('shows activity for authorized %s opportunities without submissions', async participation => {
  serve([{ ...invitation, participation }])
  mount()
  expect(await screen.findByRole('link', { name: 'Supplier activity' })).toHaveAttribute('href', '/home/submissions')
  expect(fetch).toHaveBeenCalledWith('/api/procurement/credentials/participation', { cache: 'no-store' })
})

test('keeps activity available for an existing submission without invitations', async () => {
  serve([], [{ id: 'submission' }])
  mount()
  expect(await screen.findByRole('link', { name: 'Supplier activity' })).toHaveAttribute('href', '/home/submissions')
})

test('keeps activity available for a saved draft without submissions or invitations', async () => {
  serve([], [], [{ id: 'draft' }])
  mount()
  expect(await screen.findByRole('link', { name: 'Supplier activity' })).toHaveAttribute('href', '/home/submissions')
  expect(fetch).toHaveBeenCalledWith('/api/procurement/credentials/drafts/list', { cache: 'no-store' })
})

test.each([
  { opportunities: [] },
  { opportunities: [{ ...invitation, directly_invited: false, visibility: 'public', participation: 'open' }] },
  { opportunities: [{ ...invitation, directly_invited: false }] },
])('does not show supplier activity for public discovery alone (%j)', async ({ opportunities }) => {
  serve(opportunities)
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(activity()).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Discover tenders' })).toHaveAttribute('href', '/tenders')
})

test('does not infer invitation access from a failed participation request', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/participation')
    ? response({ error: 'Access denied' }, false) : response({ data: [] }))
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(activity()).not.toBeInTheDocument()
})

test('authorized invitations still enable activity if the submissions request fails', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/participation')
    ? response({ opportunities: [invitation] }) : response({ error: 'Unavailable' }, false))
  mount()
  expect(await screen.findByRole('link', { name: 'Supplier activity' })).toBeInTheDocument()
})

test('does not request private activity or show its access for a signed-out person', () => {
  user = null
  mount()
  expect(fetch).not.toHaveBeenCalled()
  expect(activity()).not.toBeInTheDocument()
})

test('does not show the access while participation is still loading', async () => {
  let resolve!: (value: Response) => void
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/participation')
    ? new Promise<Response>(done => { resolve = done }) : response({ data: [] }))
  mount()
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  expect(activity()).not.toBeInTheDocument()
  resolve(response({ opportunities: [invitation] }))
  expect(await screen.findByRole('link', { name: 'Supplier activity' })).toBeInTheDocument()
})