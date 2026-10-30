import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import SubmissionsPage from '@/app/home/submissions/page'
import ProfilePage from '@/app/home/profile/page'
import { PortalDemoProvider } from '@/app/home/demo-context'
import { TenderDetailView } from '@/app/tenders/detail-view'
import { TenderDirectoryView } from '@/app/tenders/directory-view'
import { TenderSubmissionEntry } from '@/app/tenders/submission-entry'
import { demoPublicTenders } from '@/lib/demo-data/procurement-portal'

jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'real-user' }, isLoading: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/tenders/public-header', () => ({ TenderHeader: () => <header>Public tenders</header>, TenderFooter: () => <footer /> }))
jest.mock('@/app/buyer/profile/page', () => ({ __esModule: true, default: () => { throw new Error('Live buyer profile must not mount in demo') } }))
jest.mock('@/app/components/navigation/topbar-primary-actions', () => ({ TopBarPrimaryActions: ({ children }: { children: ReactNode }) => <div>{children}</div> }))

beforeEach(() => {
  jest.clearAllMocks()
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver
})
function renderDemo(children: ReactNode) {
  return render(<SWRConfig value={{ provider: () => new Map() }}><PortalDemoProvider demo>{children}</PortalDemoProvider></SWRConfig>)
}

it('navigates opportunity, saved draft and quotation tabs without procurement requests', () => {
  renderDemo(<SubmissionsPage />)
  expect(screen.getAllByText('Northstar Technology').length).toBeGreaterThan(0)
  fireEvent.click(screen.getAllByRole('button', { name: /prepare/i })[0])
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Submit quotation/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled()
  expect(screen.queryByText(/This fictional scenario is read-only/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
  fireEvent.mouseDown(screen.getByRole('tab', { name: /draft/i }), { button: 0, ctrlKey: false })
  expect(screen.getByText('NS-2026-1042-DRAFT')).toBeInTheDocument()
  fireEvent.mouseDown(screen.getByRole('tab', { name: /quotation/i }), { button: 0, ctrlKey: false })
  expect(screen.getByText('demo-quote-northstar')).toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalled()
})

it('shows credential history and read-only metadata without live profile, downloads or uploads', () => {
  renderDemo(<ProfilePage />)
  expect(screen.getByRole('heading', { name: 'Alex Morgan' })).toBeInTheDocument()
  expect(screen.getAllByText(/Example only · no file stored/)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Preview credential' }))
  expect(screen.getByDisplayValue('Alex Morgan')).toBeDisabled()
  expect(screen.getByRole('button', { name: /Save revision/i })).toBeDisabled()
  expect(document.querySelector('a[href^="/api/"]')).toBeNull()
  expect(global.fetch).not.toHaveBeenCalled()
})

it('opens a public tender proposal preview without loading live participation', () => {
  render(<TenderDetailView siteSlug="demo-procurement" tenderSlug="demo-tender-sealed" tender={demoPublicTenders.find(row => row.tender_slug === 'demo-tender-sealed')} closed={false} demo />)
  fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Preview proposal' }))
  expect(screen.queryByText(/Fictional scenario/)).not.toBeInTheDocument()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Save draft/ })).toBeDisabled()
  expect(global.fetch).not.toHaveBeenCalled()
})

it('keeps directory and site cards linked to both demo tender details', () => {
  render(<TenderDirectoryView rows={demoPublicTenders} page={0} search="" error={null} closedIds={['demo-publication-awarded']} demo />)
  expect(screen.queryByText(/Fictional procurement scenarios/)).not.toBeInTheDocument()
  for (const row of demoPublicTenders) {
    expect(document.querySelector(`a[href="/tenders/demo-procurement/${row.tender_slug}"]`)).toBeInTheDocument()
  }
  expect(document.querySelector('a[href="/tenders/demo-procurement"]')).toBeInTheDocument()
  expect(global.fetch).not.toHaveBeenCalled()
})

it('opens the awarded workspace order on app instead of the commercial host', () => {
  render(<TenderDetailView siteSlug="demo-procurement" tenderSlug="demo-tender-awarded"
    tender={demoPublicTenders.find(row => row.tender_slug === 'demo-tender-awarded')} closed demo />)
  expect(screen.getByRole('link', { name: 'View awarded order' })).toHaveAttribute('href',
    'https://app.makinari.com/purchases/orders/demo-order-workplace?client=demo-procurement')
  expect(global.fetch).not.toHaveBeenCalled()
})

it('does not enter live participation for a real publication while demo mode is active', () => {
  renderDemo(<TenderSubmissionEntry publicationId="real-publication" open onClose={() => {}} returnTo="/tenders" />)
  expect(screen.getByText('Real tender participation is disabled in demo mode.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Browse demo tenders' })).toHaveAttribute('href', '/tenders')
  expect(global.fetch).not.toHaveBeenCalled()
})