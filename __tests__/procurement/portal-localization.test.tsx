import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { LocalizationProvider, useLocalization, type SupportedLocale } from '@/app/context/LocalizationContext'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import { procurementMessage } from '@/app/purchases/procurement/i18n/messages'
import { TenderDirectoryView } from '@/app/tenders/directory-view'
import { TenderDetailView } from '@/app/tenders/detail-view'
import TenderNotFound from '@/app/tenders/not-found'
import TenderError from '@/app/tenders/error'
import { CredentialForm } from '@/app/home/profile/credential-form'
import { CredentialManager } from '@/app/home/profile/credential-manager'
import { SubmissionForm } from '@/app/home/submissions/submission-form'
import SubmissionsPage from '@/app/home/submissions/page'
import { ProcurementTab } from '@/app/catalog/procurement/ProcurementTab'
import { OfferForm } from '@/app/catalog/procurement/OfferForm'
import { SharedEvidence } from '@/app/purchases/procurement/evidence/shared-evidence'
import { RepresentativeManager } from '@/app/purchases/procurement/evidence/representative-manager'
import type { PublicTenderRow } from '@/app/tenders/public-data'
import type { Opportunity } from '@/app/home/submissions/types'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account-owned' }, isLoading: false }) }))
jest.mock('@/app/components/commerce/use-commerce-sign-in-href', () => ({ useCommerceSignInHref: () => ({ href: '/auth', onClick: jest.fn() }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))

const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja']
const copy = (locale: SupportedLocale, key: string) => rawLocaleMessages[locale][`procurement.portal.${key}`]
const response = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data }) as Response
const fetchMock = jest.fn()
function Controls() {
  const { setLocale } = useLocalization()
  return <>{locales.map(locale => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}</>
}
function Harness({ children }: { children: ReactNode }) {
  return <LocalizationProvider preferredLocale="en" preferenceScope="portal-localization-test">
    <SWRConfig value={{ provider: () => new Map(), revalidateOnFocus: false, shouldRetryOnError: false }}>
      <Controls /><TopBarPrimaryActionsSlot />{children}
    </SWRConfig>
  </LocalizationProvider>
}
const requirement = { id: 'requirement-owned', description: 'User-authored technical description', quantity: 1250, unit: 'business-owned unit' }
const publication = { site_slug: 'business-owned-site', tender_slug: 'tender-owned', publication_id: 'publication-owned', version: 2,
  status: 'published', published_at: '2026-10-01T00:00:00Z', snapshot: { title: 'User-authored title', description: 'User-authored published description',
    requirements: [requirement], participation: 'approved_suppliers', opening_policy: 'after_close', participation_deadline: '2030-10-01T12:00:00Z', opening_at: '2030-10-02T12:00:00Z' } } as PublicTenderRow
const opportunity: Opportunity = { ...publication.snapshot, site_id: 'buyer-owned', supplier_id: '11111111-1111-4111-8111-111111111114', supplier_name: 'User-authored supplier',
  tender_id: '11111111-1111-4111-8111-111111111112', publication_id: '11111111-1111-4111-8111-111111111113', version: 2, currency: 'MXN' }
const revision = { id: 'revision-owned', credential_id: 'credential-owned', revision: 3,
  metadata: { holder_kind: 'person', holder_name: 'User-authored holder', title: 'User-authored credential', type: 'custom_business_type',
    issuer: 'User-authored issuer', reference: 'REF-USER', scope: '', issued_on: null, expires_on: '2030-10-01', non_expiring: false },
  original_name: 'user-owned-file.pdf', mime_type: 'application/pdf', byte_size: 1250, created_at: '2026-10-01T12:00:00Z', state: 'ready' }
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Object.defineProperty(global.crypto, 'randomUUID', { value: () => '11111111-1111-4111-8111-111111111111', configurable: true })
})
beforeEach(() => { localStorage.clear(); fetchMock.mockReset(); global.fetch = fetchMock })

test('all five portal catalogs contain explicit translations and identical interpolation keys', () => {
  const keys = Object.keys(rawLocaleMessages.en).filter(key => key.startsWith('procurement.portal.')).sort()
  expect(keys.length).toBeGreaterThan(220)
  for (const locale of locales) {
    expect(Object.keys(rawLocaleMessages[locale]).filter(key => key.startsWith('procurement.portal.')).sort()).toEqual(keys)
    for (const key of keys) {
      expect(rawLocaleMessages[locale][key].trim()).not.toBe('')
      expect((rawLocaleMessages[locale][key].match(/\{\{\w+\}\}/g) ?? []).sort()).toEqual((rawLocaleMessages.en[key].match(/\{\{\w+\}\}/g) ?? []).sort())
    }
    if (locale !== 'en') expect(keys.filter(key => rawLocaleMessages[locale][key] !== rawLocaleMessages.en[key]).length / keys.length).toBeGreaterThan(0.96)
  }
})

test('server-loaded public views switch deeply without fetching or translating published business data', () => {
  render(<Harness><TenderDirectoryView rows={[publication]} page={1} search="business search" closedIds={[]} error={null} /><TenderDetailView siteSlug={publication.site_slug} tenderSlug={publication.tender_slug} tender={publication} closed={false} /></Harness>)
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('heading', { name: copy(locale, 'public.discover') })).toBeInTheDocument()
    for (const button of screen.getAllByRole('button', { name: copy(locale, 'public.submit') })) {
      expect(button).toBeEnabled()
    }
    expect(screen.getByRole('link', { name: 'User-authored title' })).toHaveAttribute('href', '/tenders/business-owned-site/tender-owned')
    expect(screen.getAllByText(copy(locale, 'detail.approvedHint')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(new RegExp(rawLocaleMessages[locale]['procurement.values.approved_suppliers'])).length).toBeGreaterThan(0)
    expect(screen.getByText('User-authored technical description')).toBeInTheDocument()
    expect(screen.getAllByText('User-authored published description')).toHaveLength(2)
    expect(screen.getByText(/business-owned unit/)).toBeInTheDocument()
    expect(screen.queryByText(/procurement\.portal\./)).not.toBeInTheDocument()
  }
  expect(fetchMock).not.toHaveBeenCalled()
})

test('public error and not-found presentation follow language without retrying automatically', () => {
  const retry = jest.fn()
  render(<Harness><TenderError error={new Error('private diagnostic')} reset={retry} /><TenderNotFound /></Harness>)
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('heading', { name: copy(locale, 'public.notFound') })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'public.unavailable'))
    expect(screen.queryByText('private diagnostic')).not.toBeInTheDocument()
  }
  expect(retry).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test('credential upload drafts and retained server validation translate without another upload', async () => {
  fetchMock.mockResolvedValue(response({ error: 'Expiry must follow issue date' }, 422))
  render(<Harness><CredentialForm onSaved={jest.fn()} onCancel={jest.fn()} /></Harness>)
  fireEvent.change(screen.getByLabelText(copy('en', 'credentials.legalName')), { target: { value: 'User-owned legal name' } })
  fireEvent.change(screen.getByLabelText(copy('en', 'credentials.file')), { target: { files: [new File(['%PDF-'], 'unchanged-user-file.pdf', { type: 'application/pdf' })] } })
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
  await screen.findByRole('alert')
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(copy(locale, 'credentials.uploadPersonal'))
    expect(screen.getByLabelText(copy(locale, 'credentials.legalName'))).toHaveValue('User-owned legal name')
    expect(screen.getByText(/unchanged-user-file.pdf/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(procurementMessage('Expiry must follow issue date', locale))
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
  const sent = fetchMock.mock.calls[0][1].body as FormData
  expect(JSON.parse(sent.get('metadata') as string).metadata.holder_name).toBe('User-owned legal name')
})

test('submission locks and retained rejection survive five-language switches with identical canonical payload', async () => {
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
    if (url.includes('/credentials/drafts')) return options?.method === 'PUT'
      ? response({ draft: JSON.parse(String(options.body)).draft, draft_revision: 1 })
      : response({ draft: null, draft_revision: null })
    return options?.method === 'POST' ? response({ error: 'Forbidden' }, 403) : response({ credentials: [] })
  })
  render(<Harness><SubmissionForm opportunity={opportunity} onSubmitted={jest.fn()} onCancel={jest.fn()} /></Harness>)
  await waitFor(() => expect(screen.getByLabelText(copy('en', 'submission.reference'))).toBeEnabled())
  fireEvent.change(screen.getByLabelText(copy('en', 'submission.reference')), { target: { value: 'USER-REFERENCE' } })
  fireEvent.change(screen.getByLabelText(/Unit net price/), { target: { value: '1250' } })
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
  await screen.findByText('Forbidden')
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByLabelText(copy(locale, 'submission.reference'))).toHaveValue('USER-REFERENCE')
    expect(screen.getByLabelText(copy(locale, 'submission.reference'))).toBeDisabled()
    expect(screen.getByText(copy(locale, 'submission.locked'))).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(procurementMessage('Forbidden', locale))
    expect(screen.getByText(/User-authored technical description/)).toBeInTheDocument()
    expect(screen.getByText(/business-owned unit/)).toBeInTheDocument()
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
  fireEvent.click(screen.getByRole('button', { name: copy('ja', 'submission.submit') }))
  await waitFor(() => expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2))
  const posts = fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')
  expect(posts[0][1].body).toBe(posts[1][1].body)
  expect(JSON.parse(posts[0][1].body)).toMatchObject({ supplier_id: opportunity.supplier_id, reference: 'USER-REFERENCE', lines: [{ requirement_id: 'requirement-owned', unit_net_minor: 1250 }], evidence: [] })
})

test('private/shared evidence and representative states are localized while identifiers and files stay unchanged', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/shared?') ? response({ evidence: [{ id: 'shared-owned', requirement_id: 'requirement-owned', revision_id: revision.id, revision }] })
    : url.includes('/representatives?') ? response({ representatives: [{ id: 'grant-owned', user_id: 'verified-user-id', revoked_at: '2026-10-01' }] })
      : response({ credentials: [{ id: 'credential-owned', version: 1, archived_at: null, revisions: [revision] }], assessment: { status: 'pending', reason: 'No credential assessment worker is configured. No authenticity or acceptance decision has been made.' } }))
  render(<Harness><CredentialManager /><SharedEvidence siteId="buyer-owned" quotationId="quote-owned" /><RepresentativeManager siteId="buyer-owned" supplierId="supplier-owned" /></Harness>)
  await screen.findByText('user-owned-file.pdf')
  await screen.findByText('verified-user-id')
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('link', { name: copy(locale, 'credentials.download') })).toHaveAttribute('href', '/api/procurement/credentials/revisions/revision-owned/file')
    expect(screen.getByRole('link', { name: copy(locale, 'evidence.download') })).toHaveAttribute('href', '/api/procurement/credentials/revisions/revision-owned/file')
    expect(screen.getByText(copy(locale, 'representatives.revoked'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy(locale, 'representatives.restore') })).toBeInTheDocument()
    expect(screen.getByText('custom_business_type')).toBeInTheDocument()
    expect(screen.getByText('user-owned-file.pdf')).toBeInTheDocument()
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
})

test('catalog procurement translates offer facts and preserves business units, terms, currency, and network count', async () => {
  fetchMock.mockResolvedValue(response({ item: { procurement_enabled: true, status: 'active' }, can_edit: true, can_add_offer: false,
    offers: [{ id: 'offer-owned', supplier_id: 'supplier-owned', purchase_unit: 'custom carton', units_per_purchase_unit: 1250, minimum_quantity: 2, lead_time_days: 3, unit_price_minor: 1250, currency: 'MXN', valid_from: '2026-01-01', valid_until: '2030-01-01', terms: 'User-authored commercial terms' }], suppliers: [{ id: 'supplier-owned', name: 'User-authored supplier', status: 'approved' }], total: 1 }))
  render(<Harness><ProcurementTab itemId="item-owned" siteId="buyer-owned" /></Harness>)
  await screen.findByText('custom carton')
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByText(copy(locale, 'catalog.capability'))).toBeInTheDocument()
    expect(screen.getByText(rawLocaleMessages[locale]['procurement.values.approved'])).toBeInTheDocument()
    expect(screen.getByText(/MXN/)).toBeInTheDocument()
    expect(screen.getByText('custom carton')).toBeInTheDocument()
    expect(screen.getByText('User-authored commercial terms')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: copy(locale, 'catalog.stockLink') })).toHaveAttribute('href', '/inventory/minimums')
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
})

test('supplier offer dialog retains typed business units and selected supplier through all languages', async () => {
  fetchMock.mockResolvedValue(response({ suppliers: [{ id: 'supplier-owned', name: 'User-authored supplier' }], total: 1 }))
  render(<Harness><OfferForm siteId="buyer-owned" endpoint="/api/procurement/catalog/item-owned?site_id=buyer-owned" onSaved={jest.fn()} /></Harness>)
  fireEvent.click(screen.getByRole('button', { name: copy('en', 'offer.add') }))
  await waitFor(() => expect(screen.getByPlaceholderText(copy('en', 'offer.selectSupplier'))).toBeEnabled())
  fireEvent.click(screen.getByPlaceholderText(copy('en', 'offer.selectSupplier')))
  fireEvent.click(screen.getByText('User-authored supplier'))
  fireEvent.change(screen.getByLabelText(copy('en', 'offer.purchaseUnit')), { target: { value: 'User-owned carton' } })
  fireEvent.change(screen.getByLabelText(copy('en', 'offer.terms')), { target: { value: 'User-authored terms' } })
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(copy(locale, 'offer.title'))
    expect(screen.getByLabelText(copy(locale, 'offer.purchaseUnit'))).toHaveValue('User-owned carton')
    expect(screen.getByLabelText(copy(locale, 'offer.terms'))).toHaveValue('User-authored terms')
    expect(screen.getByPlaceholderText(copy(locale, 'offer.selectSupplier'))).toHaveValue('User-authored supplier')
    expect(screen.getByRole('button', { name: rawLocaleMessages[locale]['procurement.common.clearSelection'] })).toBeInTheDocument()
    expect(screen.getByLabelText(copy(locale, 'offer.currency'))).toHaveValue('USD')
    expect(screen.getByText(copy(locale, 'offer.moneyHint'))).toBeInTheDocument()
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})

test('supplier activity list translates submitted money and columns without altering quotation references', async () => {
  fetchMock.mockImplementation(async (url: string) => url.includes('/participation') ? response({ opportunities: [] }) : response({ data: [{ id: 'receipt-owned', reference: 'USER-REFERENCE', tender_title: 'User-authored tender', currency: 'MXN', net_amount_minor: 1250, tax_amount_minor: 200, submitted_at: '2026-10-01T12:00:00Z' }] }))
  render(<Harness><SubmissionsPage /></Harness>)
  fireEvent.mouseDown(screen.getByRole('tab', { name: copy('en', 'activity.quotations') }), { button: 0, ctrlKey: false })
  await screen.findByText('USER-REFERENCE')
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('heading', { name: copy(locale, 'activity.title') })).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText(copy(locale, 'activity.netTax'))).toBeInTheDocument()
    expect(within(table).getByText('USER-REFERENCE')).toBeInTheDocument()
    expect(within(table).getByText('receipt-owned')).toBeInTheDocument()
    expect(within(table).getByText(/MXN/)).toBeInTheDocument()
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
})

test('supplier offer displays all schema problems with localized field labels without attempting a write', async () => {
  fetchMock.mockResolvedValue(response({ suppliers: [], total: 0 }))
  render(<Harness><OfferForm siteId="buyer-owned" endpoint="/api/procurement/catalog/item-owned?site_id=buyer-owned" onSaved={jest.fn()} /></Harness>)
  fireEvent.click(screen.getByRole('button', { name: copy('en', 'offer.add') }))
  await waitFor(() => expect(screen.getByPlaceholderText(copy('en', 'offer.selectSupplier'))).toBeEnabled())
  fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
  const reads = fetchMock.mock.calls.length
  for (const locale of locales) {
    fireEvent.click(screen.getByText(locale, { exact: true }))
    expect(screen.getByRole('alert').querySelectorAll('li').length).toBeGreaterThan(2)
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'offer.purchaseUnit'))
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'offer.validFrom'))
    if (locale !== 'en') expect(screen.getByRole('alert')).not.toHaveTextContent('String must contain')
  }
  expect(fetchMock).toHaveBeenCalledTimes(reads)
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true)
})