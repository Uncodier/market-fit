import { render, screen, waitFor } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import ClientWrapper from '@/app/client-wrapper'
import { rememberInternalPath } from '@/app/documents/internal-back'

jest.mock('@/app/layout-client', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) =>
  <main aria-label="Workspace"><aside>Workspace sidebar</aside>{children}</main> }))
jest.mock('@/app/components/DemoBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/components/VersionCheck', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/components/permissions/ViewOnlyBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/components/onboarding/GuidedTour', () => ({ GuidedTour: () => null }))
jest.mock('@/app/documents/internal-back', () => ({ rememberInternalPath: jest.fn() }))

beforeEach(() => { jest.clearAllMocks() })

it('renders the lazy workspace shell and its content inside Suspense', async () => {
  jest.mocked(usePathname).mockReturnValue('/content')
  render(<ClientWrapper><h1>Persisted content</h1></ClientWrapper>)
  expect(await screen.findByRole('main', { name: 'Workspace' })).toBeVisible()
  expect(screen.getByText('Workspace sidebar')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Persisted content' })).toBeVisible()
  expect(rememberInternalPath).toHaveBeenCalledWith('/content')
})

it.each(['/auth', '/create-site'])('does not render workspace dependencies on %s', pathname => {
  jest.mocked(usePathname).mockReturnValue(pathname)
  render(<ClientWrapper><h1>Public account content</h1></ClientWrapper>)
  expect(screen.queryByText('Workspace sidebar')).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toBeVisible()
  expect(screen.getByRole('heading')).toHaveTextContent('Public account content')
})

it('preserves the buyer-owned main landmark without nesting a workspace main', () => {
  jest.mocked(usePathname).mockReturnValue('/buyer/orders')
  render(<ClientWrapper><main aria-label="Buyer"><h1>Buyer orders</h1></main></ClientWrapper>)
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(screen.getByRole('main', { name: 'Buyer' })).toBeVisible()
  expect(screen.queryByText('Workspace sidebar')).not.toBeInTheDocument()
})

it('can enter and leave the workspace shell without losing the selected public route', async () => {
  jest.mocked(usePathname).mockReturnValue('/auth')
  const view = render(<ClientWrapper><h1>Account</h1></ClientWrapper>)
  jest.mocked(usePathname).mockReturnValue('/leads')
  view.rerender(<ClientWrapper><h1>Leads</h1></ClientWrapper>)
  await waitFor(() => expect(screen.getByRole('main', { name: 'Workspace' })).toBeVisible())
  jest.mocked(usePathname).mockReturnValue('/buyer/orders')
  view.rerender(<ClientWrapper><main aria-label="Buyer">Orders</main></ClientWrapper>)
  expect(screen.queryByText('Workspace sidebar')).not.toBeInTheDocument()
  expect(screen.getAllByRole('main')).toHaveLength(1)
})