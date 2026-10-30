import { render, screen } from '@testing-library/react'
import { RequestList } from '@/app/purchases/requests/request-list'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import { SuppliersWorkspace } from '@/app/suppliers/components/workspace'
import { ProcurementPage } from '@/app/purchases/procurement/components/procurement-page'
import Approvals from '@/app/purchases/procurement/approvals/page'
import NewRequest from '@/app/purchases/requests/new/page'
import { CredentialManager } from '@/app/home/profile/credential-manager'
import Submissions from '@/app/home/submissions/page'
import MinimumsPage from '@/app/inventory/minimums/page'

jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: null, isLoading: true }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ locale: 'en', t: (key: string) => key }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null, isLoading: true }) }))

test.each([
  ['requests', <RequestList key="requests" />], ['request detail', <RequestDetail key="detail" id="request" />],
  ['new request', <NewRequest key="new" />], ['tenders', <TenderList key="tenders" />],
  ['suppliers', <SuppliersWorkspace key="suppliers" />], ['policies', <ProcurementPage key="policies" screen="settings" />],
  ['rules', <ProcurementPage key="rules" screen="rules" />], ['minimums', <MinimumsPage key="minimums" />],
  ['approvals', <Approvals key="approvals" />], ['credentials', <CredentialManager key="credentials" />], ['submissions', <Submissions key="submissions" />],
])('%s uses a skeleton during context hydration without fetching or showing selection messages', (_name, component) => {
  jest.mocked(fetch).mockClear()
  render(component)
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByText(/select a|sign in/i)).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})