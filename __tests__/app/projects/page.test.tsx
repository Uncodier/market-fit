import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ProjectsPage from '@/app/projects/page'
import type { Site } from '@/app/context/site-types'

const mockPush = jest.fn()
const mockRouter = { push: mockPush }
const mockSelect = jest.fn()
const mockRefresh = jest.fn()
const project = { id: 'project-1', name: 'Project One', description: 'First project' } as Site
let mockMode: string
let mockSite: { sites: Site[]; currentSite: Site | null; isLoading: boolean; error: Error | null; workspaceAccessLost?: boolean }

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(mockMode),
}))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ ...mockSite, setCurrentSite: mockSelect, refreshSites: mockRefresh }) }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: (key: string, params?: { name?: string; error?: string }) =>
    params?.name ? `Select ${params.name}` : params?.error ?? key }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockMode = 'manage=1'
  mockSite = { sites: [], currentSite: null, isLoading: true, error: null }
})

it('shows a placeholder only until displayable project rows become available', () => {
  const { container, rerender } = render(<ProjectsPage />)
  const mark = screen.getByRole('img', { name: 'Makinari' })
  expect(mark).toHaveAttribute('src', '/images/isotipo.svg')
  expect(mark).toHaveStyle({ height: '48px', width: 'auto' })
  expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  mockSite.sites = [project]
  rerender(<ProjectsPage />)
  expect(screen.getByRole('heading', { name: project.name })).toBeVisible()
  expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument()
})

it('leaves project cards mounted during revalidation and shows failures without hiding them', () => {
  mockSite.sites = [project]
  mockSite.isLoading = false
  mockMode = ''
  const { rerender } = render(<ProjectsPage />)
  const projectLabel = screen.getByRole('heading', { name: project.name })
  mockSite.isLoading = true
  rerender(<ProjectsPage />)
  expect(screen.getByRole('heading', { name: project.name })).toBe(projectLabel)
  mockSite.isLoading = false
  mockSite.error = new Error('Temporarily unavailable')
  rerender(<ProjectsPage />)
  expect(screen.getByRole('status')).toHaveTextContent('Temporarily unavailable')
  expect(screen.getByRole('heading', { name: project.name })).toBe(projectLabel)
})

it('does not let a click supersede settings hydration and keeps the existing robots redirect', async () => {
  mockMode = ''
  mockSite.sites = [project]
  mockSite.currentSite = project
  const { rerender } = render(<ProjectsPage />)
  const select = screen.getByRole('button', { name: 'Select Project One' })
  expect(select).toBeDisabled()
  fireEvent.click(select)
  expect(mockSelect).not.toHaveBeenCalled()
  expect(mockPush).not.toHaveBeenCalled()
  mockSite.isLoading = false
  rerender(<ProjectsPage />)
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/robots'))
})

it('never displays demo rows in manage mode or retains rows the provider clears', () => {
  mockSite.sites = [project, { ...project, id: 'demo-site', name: 'Demo Project' }]
  const { rerender } = render(<ProjectsPage />)
  expect(screen.getByRole('heading', { name: project.name })).toBeVisible()
  expect(screen.queryByText('Demo Project')).not.toBeInTheDocument()
  mockSite.sites = []
  rerender(<ProjectsPage />)
  expect(screen.queryByText(project.name)).not.toBeInTheDocument()
})

it('explains why the selection was lost and lets the member retry or pick another project', () => {
  mockSite = { ...mockSite, workspaceAccessLost: true, isLoading: false, sites: [project] }
  mockMode = ''
  render(<ProjectsPage />)
  expect(screen.getByRole('alert')).toHaveTextContent('workspaceAccess.lostDescription')
  expect(screen.getByRole('button', { name: 'Select Project One' })).toBeEnabled()
  expect(mockPush).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
  expect(mockRefresh).toHaveBeenCalledTimes(1)
})