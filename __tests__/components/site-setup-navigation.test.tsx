import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CreateSitePage from '@/app/create-site/page'
import BillingPage from '@/app/billing/page'
import { useOptionalSite, useSite } from '@/app/context/SiteContext'
import { useAuth } from '@/app/hooks/use-auth'
import { createSiteSetupStore, siteSetupStorageKey, siteSetupStore } from '@/app/create-site/site-setup-store'
import { SiteSetupTracking } from '@/app/create-site/site-setup-tracking'
import type { SiteOnboardingValues } from '@/app/components/onboarding/schemas/onboarding-schema'

jest.mock('@/app/context/SiteContext', () => ({ useOptionalSite: jest.fn(), useSite: jest.fn() }))
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: jest.fn() }))
jest.mock('@/app/hooks/use-prevent-refresh', () => ({ useSimpleRefreshPrevention: jest.fn() }))
jest.mock('@/app/components/ChunkErrorGuard', () => ({ reloadForNewBuild: jest.fn() }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/billing/billing-initialization', () => ({ BillingInitialization: () => null }))
jest.mock('@/app/components/billing/billing-form', () => ({ BillingForm: () => <p>Billing for active project</p> }))
jest.mock('@/app/components/billing/payment-history', () => ({ PaymentHistory: () => null }))
jest.mock('@/app/components/billing/credit-usage-history', () => ({ CreditUsageHistory: () => null }))
jest.mock('@/app/components/ui/quick-nav', () => ({ QuickNav: () => null }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@/app/components/onboarding/site-onboarding', () => ({
  SiteOnboarding: ({ onComplete, isSuccess, onGoToDashboard }: {
    onComplete: (values: SiteOnboardingValues) => Promise<void>; isSuccess: boolean; onGoToDashboard: () => Promise<void>
  }) => <div>
    <button onClick={() => void onComplete({ name: 'Saved project' } as SiteOnboardingValues)}>Create project</button>
    {isSuccess && <button onClick={() => void onGoToDashboard()}>Go to dashboard</button>}
  </div>,
}))

const userId = '00000000-0000-4000-8000-000000000001'
const otherUserId = '00000000-0000-4000-8000-000000000002'
const siteId = '11111111-1111-4111-8111-111111111111'
const otherSiteId = '22222222-2222-4222-8222-222222222222'
const workflowId = `site-setup-${siteId}-1791331200000`
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response
const setupResponse = (status: string) => response({ success: true, data: { workflow_id: workflowId, setup_status: status } })
const createSite = jest.fn()
const refreshSiteBilling = jest.fn()
const fetchMock = jest.mocked(fetch)

beforeAll(() => {
  // jsdom lacks the deadline API used by the browser request implementation.
  if (!AbortSignal.timeout) Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true, value: () => new AbortController().signal,
  })
})

function RouteHarness() {
  const [route, setRoute] = useState('/create-site')
  jest.mocked(useRouter).mockReturnValue({ push: (target: string) => setRoute(target) } as never)
  if (route === '/create-site') return <CreateSitePage />
  if (route === '/billing') return <BillingPage />
  return <div>Dashboard<button onClick={() => setRoute('/billing')}>Open Billing</button></div>
}

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset()
  sessionStorage.clear()
  // A new module store models a fresh document without relying on page component state.
  Object.assign(siteSetupStore, createSiteSetupStore())
  jest.mocked(useAuth).mockReturnValue({ user: { id: userId } } as never)
  createSite.mockResolvedValue({ id: siteId })
  refreshSiteBilling.mockResolvedValue(undefined)
  jest.mocked(useOptionalSite).mockReturnValue({ createSite, refreshSiteBilling,
    setCurrentSite: jest.fn().mockResolvedValue(undefined), sites: [{ id: siteId }], isLoading: false } as never)
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: siteId, billing: {} }, isLoading: false } as never)
  fetchMock.mockResolvedValue(response({ success: true, outcome: 'initialized' }))
})

it('writes the POST result after actual creation page unmount/navigation, then shows it on Billing/remount without replay', async () => {
  let settlePost!: (value: Response) => void
  fetchMock.mockImplementation(async (target) => target === '/api/site/setup'
    ? new Promise<Response>(resolve => { settlePost = resolve })
    : response({ success: true, outcome: 'initialized' }))
  const view = render(<RouteHarness />)
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
  expect(await screen.findByRole('button', { name: 'Go to dashboard' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: pending')
  fireEvent.click(screen.getByRole('button', { name: 'Go to dashboard' }))
  await screen.findByRole('button', { name: 'Open Billing' })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  // The HTTP start is still outstanding, but its owner is not the unmounted React page.
  await act(async () => { settlePost(setupResponse('partial')) })
  fireEvent.click(screen.getByRole('button', { name: 'Open Billing' }))
  expect(await screen.findByText('Billing for active project')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: partial')
  expect(screen.getByRole('button', { name: 'Check setup status' })).toBeInTheDocument()
  expect(siteSetupStore.getSnapshot(userId, siteId)?.workflowId).toBe(workflowId)
  view.unmount()
  render(<BillingPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: partial')
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/site/setup')).toHaveLength(1)
  expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'GET')).toBe(false)
  expect(createSite).toHaveBeenCalledTimes(1)
})

it('restores pending and its workflow ID after document refresh, and performs GET only on explicit status action', async () => {
  fetchMock.mockResolvedValue(setupResponse('pending'))
  await siteSetupStore.launch(userId, siteId)
  Object.assign(siteSetupStore, createSiteSetupStore())
  fetchMock.mockClear()
  const view = render(<BillingPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: pending')
  expect(fetchMock).not.toHaveBeenCalled()
  let settleGet!: (value: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { settleGet = resolve }))
  fireEvent.click(screen.getByRole('button', { name: 'Check setup status' }))
  expect(screen.getByRole('button', { name: 'Checking setup status...' })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledWith(`/api/site/setup?workflow_id=${workflowId}`, expect.objectContaining({ method: 'GET' }))
  await act(async () => { settleGet(setupResponse('complete')) })
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: complete')
  expect(screen.queryByRole('button', { name: 'Check setup status' })).not.toBeInTheDocument()
  view.unmount()
  Object.assign(siteSetupStore, createSiteSetupStore())
  render(<BillingPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: complete')
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('updates a Billing subscriber mounted while the creation POST is still outstanding', async () => {
  let settlePost!: (value: Response) => void
  fetchMock.mockImplementation(async target => target === '/api/site/setup'
    ? new Promise<Response>(resolve => { settlePost = resolve })
    : response({ success: true, outcome: 'initialized' }))
  render(<RouteHarness />)
  fireEvent.click(screen.getByRole('button', { name: 'Create project' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Go to dashboard' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Open Billing' }))
  expect(await screen.findByText('Billing for active project')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: pending')
  await act(async () => { settlePost(setupResponse('failed')) })
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: failed')
  expect(screen.getByRole('button', { name: 'Check setup status' })).toBeInTheDocument()
  expect(createSite).toHaveBeenCalledTimes(1)
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/site/setup')).toHaveLength(1)
})

it('restores a launch-pending record without a known ID without starting setup on mount', async () => {
  let settle!: (value: Response) => void
  fetchMock.mockReturnValue(new Promise<Response>(resolve => { settle = resolve }))
  const task = siteSetupStore.launch(userId, siteId)
  const refreshedStore = createSiteSetupStore()
  expect(refreshedStore.getSnapshot(userId, siteId)?.status).toBe('unconfirmed')
  Object.assign(siteSetupStore, refreshedStore)
  render(<BillingPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: unconfirmed')
  expect(screen.getByRole('status')).toHaveTextContent('No workflow ID is available yet')
  expect(screen.queryByRole('button', { name: 'Check setup status' })).not.toBeInTheDocument()
  await refreshedStore.launch(userId, siteId)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { settle(setupResponse('pending')); await task })
})

it('never shows one user or project result on another active Billing project or an unauthenticated mount', async () => {
  fetchMock.mockResolvedValue(setupResponse('failed'))
  await siteSetupStore.launch(userId, siteId)
  const view = render(<BillingPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Background setup: failed')
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: otherSiteId, billing: {} }, isLoading: false } as never)
  view.rerender(<BillingPage />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: siteId, billing: {} }, isLoading: false } as never)
  jest.mocked(useAuth).mockReturnValue({ user: { id: otherUserId } } as never)
  view.rerender(<BillingPage />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  jest.mocked(useAuth).mockReturnValue({ user: null } as never)
  view.rerender(<BillingPage />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('rejects corrupt storage on React restore instead of rendering it or issuing any request', () => {
  sessionStorage.setItem(siteSetupStorageKey(userId, siteId)!, '{not-json')
  render(<SiteSetupTracking siteId={siteId} />)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})