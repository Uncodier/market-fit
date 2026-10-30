import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PortalSettings } from '@/app/purchases/procurement/components/portal-settings'
import { toast } from 'sonner'
import { useSite } from '@/app/context/SiteContext'

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: jest.fn(() => ({ currentSite: null })) }))

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
const site = '11111111-1111-4111-8111-111111111111'
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
beforeEach(() => { jest.mocked(fetch).mockReset(); jest.mocked(toast.success).mockClear(); jest.mocked(useSite).mockReturnValue({ currentSite: null } as never) })

test('uses the shop name slug for the public portal link instead of the internal UUID', async () => {
  jest.mocked(useSite).mockReturnValue({ currentSite: { id: site, name: 'My Workspace' } } as never)
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: true, slug: '829a0941-38cd-4b12-8d46-a838023042b7' }))
  render(<PortalSettings siteId={site} />)
  expect(await screen.findByRole('link')).toHaveAttribute('href', '/tenders/my-workspace')
  expect(screen.getByRole('link')).toHaveTextContent('/tenders/my-workspace')
})

test('portal loads as a card-shaped skeleton and only exposes controls after data arrives', async () => {
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise(done => { resolve = done }))
  const { container } = render(<PortalSettings siteId={site} />)
  expect(screen.getByRole('status', { name: 'Loading portal settings…' })).toHaveAttribute('aria-busy', 'true')
  expect(container.querySelector('[data-portal-settings-skeleton]')).not.toBeNull()
  expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(5)
  expect(screen.queryByText('Loading portal settings…')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  await act(async () => { resolve(response({ enabled: false, slug: null })) })
  expect(await screen.findByRole('checkbox')).not.toBeChecked()
  expect(container.querySelector('[data-portal-settings-skeleton]')).toBeNull()
})

test('shows workspace portal settings and saves separately from the procurement policy', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: false, slug: 'my-workspace' }))
    .mockResolvedValueOnce(response({ enabled: true, slug: 'my-workspace' }))
  render(<PortalSettings siteId={site} />)
  const toggle = await screen.findByRole('checkbox')
  expect(toggle).not.toBeChecked()
  expect(screen.getByRole('link')).toHaveAttribute('href', '/tenders/my-workspace')
  expect(screen.getByText(/Portal access is separate/)).toBeInTheDocument()
  fireEvent.click(toggle)
  fireEvent.click(screen.getByRole('button', { name: 'Save portal settings' }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Portal settings saved.'))
  expect(toast.success).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Portal settings saved.')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenLastCalledWith(`/api/procurement/tenders/portal?site_id=${site}`, expect.objectContaining({
    method: 'POST', body: JSON.stringify({ enabled: true }),
  }))
  expect(screen.getByRole('button', { name: 'Save portal settings' })).toBeDisabled()
})

test('failed saves require a reload and never claim success', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: false, slug: null })).mockResolvedValueOnce(response({}, false))
  render(<PortalSettings siteId={site} />)
  fireEvent.click(await screen.findByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Save portal settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Portal save was not confirmed')
  expect(screen.getByRole('button', { name: 'Save portal settings' })).toBeDisabled()
  expect(screen.queryByText('Portal settings saved.')).not.toBeInTheDocument()
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: true, slug: 'workspace' }))
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('checkbox')).toBeChecked()
})

test('workspace switches discard the previous portal state', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: true, slug: 'first-workspace' }))
  const view = render(<PortalSettings siteId={site} />)
  await screen.findByRole('checkbox')
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: false, slug: 'second-workspace' }))
  view.rerender(<PortalSettings siteId="22222222-2222-4222-8222-222222222222" />)
  expect(screen.queryByText('/tenders/first-workspace')).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeChecked())
  expect(screen.getByRole('link')).toHaveAttribute('href', '/tenders/second-workspace')
})

test('disabled/demo settings do not permit a save', async () => {
  jest.mocked(fetch).mockResolvedValueOnce(response({ enabled: false, slug: null }))
  render(<PortalSettings siteId={site} disabled />)
  expect(await screen.findByRole('checkbox')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save portal settings' })).toBeDisabled()
})