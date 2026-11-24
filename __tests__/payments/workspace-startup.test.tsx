import { render, screen } from '@testing-library/react'
import { shouldUseWorkspaceProviders } from '@/app/config/routes'
import { SiteProvider, useSite } from '@/app/context/SiteContext'
import { fetchAccessibleSitesClient } from '@/lib/sites/fetch-accessible-sites'
import PaymentsLayout from '@/app/payments/layout'

// Keep the real SiteProvider lifecycle so a nested provider performs (and is
// charged for) its own selector and settings reads, not just a component render.
jest.mock('@/app/providers/WorkspaceProviders', () => ({
  __esModule: true, default: ({ children }: React.PropsWithChildren) => <SiteProvider>{children}</SiteProvider>,
}))
jest.mock('@/lib/sites/fetch-accessible-sites', () => ({ fetchAccessibleSitesClient: jest.fn() }))
jest.mock('@/app/context/site-resource-sync', () => ({ useSiteResourceSync: jest.fn() }))
jest.mock('@/lib/sites/logo-background-sync', () => ({ syncSiteLogosInBackground: jest.fn() }))
const mockSettings = jest.fn(async () => ({ data: { about: 'Hydrated settings' }, error: null }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-actor' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
  },
  from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: mockSettings }), single: mockSettings }) }) }),
  channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: jest.fn(),
}) }))

function Probe({ label }: { label: string }) {
  const { currentSite, isLoading } = useSite()
  return <div>{label}:{isLoading ? 'loading' : currentSite?.settings?.about}</div>
}

it('shares the root workspace selection with the Payments page, hydrating it only once', async () => {
  const siteId = '11111111-1111-4111-8111-111111111111'
  localStorage.setItem('currentSiteId', siteId)
  jest.mocked(fetchAccessibleSitesClient).mockResolvedValue({ sites: [{ id: siteId, name: 'Main',
    user_id: 'test-actor', logo_url: 'logo', description: 'Main workspace' }], error: null } as never)
  expect(shouldUseWorkspaceProviders('/payments')).toBe(true)
  render(<SiteProvider><Probe label="shell" /><PaymentsLayout><Probe label="page" /></PaymentsLayout></SiteProvider>)
  await screen.findByText('shell:Hydrated settings')
  await screen.findByText('page:Hydrated settings')
  expect([jest.mocked(fetchAccessibleSitesClient).mock.calls.length, mockSettings.mock.calls.length]).toEqual([1, 1])
})