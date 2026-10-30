import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { QuotationEvidenceDetail } from '@/app/purchases/procurement/evidence/quotation-evidence-detail'

jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: jest.fn() }))

const auth = jest.mocked(useAuthContext)
const request = jest.fn()
const sharedRevision = {
  id: 'revision-a', revision: 3,
  metadata: {
    holder_kind: 'person', holder_name: 'Fictional Holder', issuer: 'Fictional Board',
    title: 'Fictional security certificate', type: 'professional_license', reference: 'CERT-42',
    scope: 'Remote support\nNorth office', issued_on: '2025-01-10', expires_on: '2027-01-10', non_expiring: false,
  },
  original_name: 'certificate.pdf', mime_type: 'application/pdf', byte_size: 4096,
}
const shared = { id: 'share-a', requirement_id: 'requirement-a', revision_id: 'revision-a', revision: sharedRevision }
const proposal = {
  revision_id: 'proposal-revision', revision: {
    ...sharedRevision, id: 'proposal-revision', revision: 2, original_name: 'proposal.pdf',
    metadata: { ...sharedRevision.metadata, title: 'Fictional technical proposal', non_expiring: true, expires_on: null },
  },
}

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}

function mount(siteId = 'site-a', quotationId = 'quotation-a') {
  const cache = new Map()
  const config = { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false, keepPreviousData: true }
  const tree = (site: string, quotation: string) => <SWRConfig value={config}>
    <QuotationEvidenceDetail siteId={site} quotationId={quotation} />
  </SWRConfig>
  const view = render(tree(siteId, quotationId))
  return { ...view, changeScope: (site = siteId, quotation = quotationId) => view.rerender(tree(site, quotation)), cache }
}

beforeEach(() => {
  auth.mockClear()
  auth.mockReturnValue({ user: { id: 'account-a' }, isLoading: false } as never)
  request.mockReset()
  global.fetch = request
  localStorage.clear()
  document.cookie = 'market_fit_demo_site_id=; Max-Age=0; path=/'
  request.mockImplementation(async (url: string) => response(url.includes('/shared?') ? { evidence: [shared] } : { proposal }))
})

test('renders full immutable metadata and authorized revision downloads, not acceptance claims', async () => {
  const { cache } = mount('site a', 'quotation/a')
  const article = await screen.findByRole('article', { name: 'Fictional security certificate' })
  for (const text of ['Fictional Holder', 'Fictional Board', 'CERT-42', 'professional_license', 'Revision 3',
    'requirement-a', 'revision-a', 'certificate.pdf', 'application/pdf · 4,096 bytes']) {
    expect(within(article).getByText(text)).toBeInTheDocument()
  }
  expect(within(article).getByText(/Remote support/)).toHaveTextContent('Remote support North office')
  expect(within(article).getByText('Jan 10, 2025')).toHaveAttribute('datetime', '2025-01-10')
  expect(within(article).getByText('Jan 10, 2027')).toHaveAttribute('datetime', '2027-01-10')
  expect(screen.getByText('Explicitly non-expiring')).toBeInTheDocument()
  expect(within(article).getByRole('link', { name: 'Download shared evidence: certificate.pdf' }))
    .toHaveAttribute('href', '/api/procurement/credentials/revisions/revision-a/file')
  expect(screen.getByRole('link', { name: 'Download shared evidence: proposal.pdf' }))
    .toHaveAttribute('href', '/api/procurement/credentials/revisions/proposal-revision/file')
  expect(screen.getByRole('link', { name: 'Download shared evidence: proposal.pdf' })).toHaveAttribute('download', 'proposal.pdf')
  expect(screen.queryByText(/^(Accepted|Verified|Under review)$/)).not.toBeInTheDocument()
  expect(request).toHaveBeenCalledWith('/api/procurement/credentials/shared?site_id=site+a&quotation_id=quotation%2Fa',
    { cache: 'no-store', credentials: 'same-origin' })
  expect(request).toHaveBeenCalledWith('/api/procurement/credentials/proposals?site_id=site+a&quotation_id=quotation%2Fa',
    { cache: 'no-store', credentials: 'same-origin' })
  expect([...cache.keys()].join(' ')).toContain('"shared-evidence","account-a","site a","quotation/a"')
  expect([...cache.keys()].join(' ')).toContain('"shared-proposal","account-a","site a","quotation/a"')
})

test('shows loading independently and only shows empty after successful responses', async () => {
  const evidence = deferred()
  const attachment = deferred()
  request.mockImplementation((url: string) => url.includes('/shared?') ? evidence.promise : attachment.promise)
  mount()
  expect(screen.getAllByRole('status')).toHaveLength(2)
  expect(screen.queryByText(/No evidence is available/)).not.toBeInTheDocument()
  expect(screen.queryByText(/No proposal document is available/)).not.toBeInTheDocument()
  await act(async () => { attachment.resolve(response({ proposal: null })) })
  expect(screen.getByText(/No proposal document is available/)).toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  await act(async () => { evidence.resolve(response({ evidence: [] })) })
  expect(screen.getByText(/No evidence is available/)).toBeInTheDocument()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test.each([401, 403, 503])('treats HTTP %s as an error, preserves independent proposal and retries evidence', async status => {
  request.mockImplementation(async (url: string) => response(url.includes('/shared?')
    ? { error: 'Internal provider details must not be shown' } : { proposal }, url.includes('/shared?') ? status : 200))
  mount()
  expect(await screen.findByRole('alert')).not.toBeEmptyDOMElement()
  expect(screen.queryByText(/Internal provider/)).not.toBeInTheDocument()
  expect(screen.queryByText(/No evidence is available/)).not.toBeInTheDocument()
  expect(screen.getByRole('article', { name: 'Fictional technical proposal' })).toBeInTheDocument()
  request.mockImplementation(async () => response({ evidence: [shared] }))
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('article', { name: 'Fictional security certificate' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('proposal failures are not empty and do not hide available evidence', async () => {
  request.mockImplementation(async (url: string) => {
    if (url.includes('/proposals?')) throw new Error('Network unavailable')
    return response({ evidence: [shared] })
  })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable')
  expect(screen.getByRole('article', { name: 'Fictional security certificate' })).toBeInTheDocument()
  expect(screen.queryByText(/No proposal document is available/)).not.toBeInTheDocument()
})

test.each(['site', 'quotation', 'account'])('%s changes clear both old documents, including with global keepPreviousData', async scope => {
  const view = mount()
  await screen.findByRole('article', { name: 'Fictional security certificate' })
  const pending = deferred()
  request.mockImplementation(() => pending.promise)
  if (scope === 'account') auth.mockReturnValue({ user: { id: 'account-b' }, isLoading: false } as never)
  view.changeScope(scope === 'site' ? 'site-b' : 'site-a', scope === 'quotation' ? 'quotation-b' : 'quotation-a')
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getAllByRole('status')).toHaveLength(2)
  expect(screen.queryByText(/No evidence is available/)).not.toBeInTheDocument()
  await act(async () => { pending.resolve(response({ evidence: [], proposal: null })) })
  expect(screen.getByText(/No evidence is available/)).toBeInTheDocument()
  expect(screen.getByText(/No proposal document is available/)).toBeInTheDocument()
})

test('late responses from an old scope cannot replace current evidence', async () => {
  const old = deferred()
  request.mockImplementation(() => old.promise)
  const view = mount()
  request.mockImplementation(async () => response({ evidence: [], proposal: null }))
  view.changeScope('site-b', 'quotation-b')
  await screen.findByText(/No evidence is available/)
  await act(async () => { old.resolve(response({ evidence: [shared], proposal })) })
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
})

test('auth hydration never flashes empty or fetches; sign-out hides loaded documents', async () => {
  auth.mockReturnValue({ user: null, isLoading: true } as never)
  const view = mount()
  expect(screen.getByRole('status')).toHaveTextContent('Loading content')
  expect(request).not.toHaveBeenCalled()
  auth.mockReturnValue({ user: { id: 'account-a' }, isLoading: false } as never)
  view.changeScope()
  await screen.findByRole('article', { name: 'Fictional security certificate' })
  auth.mockReturnValue({ user: null, isLoading: false } as never)
  view.changeScope()
  expect(screen.queryByRole('article')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toBeInTheDocument()
  expect(request).toHaveBeenCalledTimes(2)
})

test('missing metadata remains unspecified, not non-expiring; inaccessible revisions have no download', async () => {
  request.mockImplementation(async () => response({ proposal: null, evidence: [
    { ...shared, revision: { ...sharedRevision, metadata: { ...sharedRevision.metadata, issued_on: null, expires_on: null, reference: '', scope: '' } } },
    { ...shared, id: 'unavailable-share', revision_id: 'unavailable-revision', revision: null },
  ] }))
  mount()
  await screen.findByRole('article')
  expect(screen.getAllByText('—')).toHaveLength(4)
  expect(screen.queryByText('Explicitly non-expiring')).not.toBeInTheDocument()
  expect(screen.getByText('Shared revision details are unavailable.')).toBeInTheDocument()
  expect(screen.getAllByRole('link')).toHaveLength(1)
})

test.each(['shared', 'proposals'])('malformed %s success is an error, never an empty result', async path => {
  request.mockImplementation(async (url: string) => response(url.includes(`/${path}?`) ? {} : { evidence: [], proposal: null }))
  mount()
  await screen.findByRole('alert')
  expect(screen.queryByText(path === 'shared' ? /No evidence is available/ : /No proposal document is available/)).not.toBeInTheDocument()
})

test.each(['demo-site', 'site-a'])('demo boundary is fictional and no-network even with stale live site %s', async site => {
  if (site === 'site-a') document.cookie = 'market_fit_demo_site_id=demo-site; path=/'
  mount(site)
  expect(screen.queryByText(/Fictional documents for this demonstration/)).not.toBeInTheDocument()
  expect(screen.getAllByRole('article')).toHaveLength(3)
  expect(screen.getAllByText('Fictional file metadata only. No file is stored or available to download.')).toHaveLength(3)
  await waitFor(() => expect(request).not.toHaveBeenCalled())
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})

test('demo uses the same rich revision cards with fictional metadata, dates, scopes and no decision statuses', () => {
  mount('demo-site', 'demo-quote-northstar')
  expect(screen.getAllByRole('article')).toHaveLength(3)
  const certificate = screen.getByRole('article', { name: 'Information security training certificate (fictional sample)' })
  for (const text of ['Taylor Example (fictional person)', 'Example Professional Learning Board (fictional issuer)',
    'DEMO-SEC-2026-042', 'Revision 2', 'fictional-security-training.pdf', 'application/pdf · 98,304 bytes',
    'Information security training — fictional requirement']) {
    expect(within(certificate).getByText(text)).toBeInTheDocument()
  }
  expect(within(certificate).getByText(/Personal training in secure workstation onboarding/)).toHaveTextContent('not an organization certification')
  expect(within(certificate).getByText('Feb 15, 2026')).toHaveAttribute('datetime', '2026-02-15')
  expect(within(certificate).getByText('Feb 15, 2027')).toHaveAttribute('datetime', '2027-02-15')
  expect(within(certificate).getByText('Requirement reference')).toBeInTheDocument()
  const proposal = screen.getByRole('article', { name: 'Technical proposal (fictional sample)' })
  expect(within(proposal).getByText('Northstar Technology (fictional demo supplier)')).toBeInTheDocument()
  expect(within(proposal).getByText('DEMO-NS-2026-1042')).toBeInTheDocument()
  expect(within(proposal).getByText(/Onboarding for 20 workstations/)).toHaveTextContent('Payment terms: net 30.')
  expect(within(proposal).getByText('Oct 20, 2026')).toHaveAttribute('datetime', '2026-10-20')
  expect(screen.getByText('Explicitly non-expiring')).toBeInTheDocument()
  expect(screen.getAllByText('Fictional file metadata only. No file is stored or available to download.')).toHaveLength(3)
  expect(screen.queryByText(/^(Accepted|Verified|Under review|Approved)$/)).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(request).not.toHaveBeenCalled()
  expect(auth).not.toHaveBeenCalled()
})

test('demo quotation changes replace sample proposal references without fetching', () => {
  const view = mount('demo-site', 'demo-quote-northstar')
  view.changeScope('demo-site', 'demo-quote-summit')
  expect(screen.queryByText('DEMO-NS-2026-1042')).not.toBeInTheDocument()
  expect(screen.getByText('DEMO-SUM-2026-208')).toBeInTheDocument()
  expect(screen.getByText('Summit Solutions (fictional demo supplier)')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Preview sample evidence' })).not.toBeInTheDocument()
  expect(request).not.toHaveBeenCalled()
})