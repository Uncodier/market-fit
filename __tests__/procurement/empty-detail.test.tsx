import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SWRConfig } from 'swr'
import { LocalizationProvider, type SupportedLocale } from '@/app/context/LocalizationContext'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { SupplierContacts } from '@/app/suppliers/components/supplier-contacts'
import { SupplierForm } from '@/app/suppliers/components/supplier-form'
import { emptySupplier, type SupplierContact } from '@/app/suppliers/schema'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import type { Tender } from '@/app/purchases/tenders/schema'
import { CredentialManager } from '@/app/home/profile/credential-manager'
import { ProcurementTab } from '@/app/catalog/procurement/ProcurementTab'
import type { CatalogProcurement } from '@/app/catalog/procurement/schema'
import { EmptyTenders } from '@/app/tenders/empty-tenders'
import { TenderListing } from '@/app/tenders/tender-listing'
import type { PublicTenderRow } from '@/app/tenders/public-data'

const siteId = '00000000-0000-4000-8000-000000000001'
const tenderId = '00000000-0000-4000-8000-000000000002'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: siteId, name: "Test workspace" } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'account-owned' } }) }))
// Isolate unrelated picker requests; EmptyCard, icons, localization and collection effects are real.
jest.mock('@/app/suppliers/components/reference-picker', () => ({ SupplierReferencePicker: () => null }))

const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja']
const copy = (locale: SupportedLocale, key: string) => rawLocaleMessages[locale][`procurement.${key}`]
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
const swrOptions = { provider: () => new Map(), revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 0 }
function shell(locale: SupportedLocale, child: ReactNode) {
  return <LocalizationProvider preferredLocale={locale} preferenceScope="empty-detail-test">
    <SWRConfig value={swrOptions}><TopBarPrimaryActionsSlot />{child}</SWRConfig>
  </LocalizationProvider>
}

/** Verify real EmptyCard markup, not just a custom paragraph displaying the same translation. */
function expectEmptyCard(locale: SupportedLocale, key: string, compact: boolean, descriptionKey?: string) {
  const heading = screen.getByRole('heading', { level: 3, name: copy(locale, key) })
  const card = heading.closest('div.w-full.relative.z-0')
  expect(card).toBeInTheDocument()
  if (!(card instanceof HTMLElement)) throw new Error('Expected the shared EmptyCard shell')
  const content = card.firstElementChild
  expect(content).toHaveClass(compact ? 'min-h-0' : 'min-h-[300px]')
  expect(card).toHaveClass(...(compact ? ['border-0', 'bg-transparent', 'shadow-none'] : ['border-dashed', 'bg-card/50']))
  if (compact) {
    expect(content).toHaveClass('py-6')
    expect(content).not.toHaveClass('min-h-[300px]')
    expect(card).not.toHaveClass('border-dashed')
  }
  const fancyIcon = card.querySelector('[class~="bg-primary/8"]')
  expect(fancyIcon).toBeInTheDocument()
  expect(fancyIcon?.querySelector('svg')).toBeInTheDocument()
  expect(fancyIcon?.querySelector('span')).toHaveStyle({ width: '24px', height: '24px' })
  if (descriptionKey) expect(within(card).getByText(copy(locale, descriptionKey))).toBeInTheDocument()
  else expect(card.querySelector('p')).not.toBeInTheDocument()
  expect(card).not.toHaveTextContent("There's no data to display at this time.")
  expect(card).not.toHaveTextContent('Most operations run automatically.')
  expect(card).not.toHaveTextContent('No data available')
  return card
}

const tender: Tender = {
  id: tenderId, site_id: siteId, version: 2, status: 'draft', portal_slug: tenderId,
  title: 'Original tender title', description: 'Original working description', request_id: null,
  currency: 'EUR', visibility: 'public', global_visible: true, participation: 'invitation_only', opening_policy: 'after_close',
  participation_deadline: '2030-10-01T12:00:00Z', opening_at: '2030-10-02T12:00:00Z',
  requirements: [{ id: 'requirement-owned', description: 'Original requirement', quantity: 2, unit: 'carton', unit_net_minor: 500, catalog_item_id: null }],
  net_amount_minor: 1000, created_by: 'account-owned', updated_at: '2026-10-01T12:00:00Z',
}
const catalog: CatalogProcurement = {
  item: { id: 'item-owned', name: 'Original catalog item', status: 'active', procurement_enabled: true },
  offers: [], suppliers: [], total: 0, can_edit: true, can_add_offer: false,
}
const publication: PublicTenderRow = {
  site_slug: 'site-owned', tender_slug: tenderId, publication_id: 'publication-owned', version: 2,
  status: 'published', published_at: '2026-10-01T12:00:00Z', snapshot: {
    title: 'Original published title', description: 'Original published description', currency: 'EUR',
    participation: 'open', opening_policy: 'after_close', participation_deadline: '2030-10-01T12:00:00Z',
    opening_at: '2030-10-02T12:00:00Z', requirements: [{ id: 'line-owned', description: 'Original requirement', quantity: 2, unit: 'carton' }],
  },
}

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => {
  localStorage.clear()
  jest.mocked(fetch).mockReset().mockRejectedValue(new Error('Unexpected request in empty-detail test'))
})

test.each(['contacts', 'form'] as const)('%s empty collection uses a compact real EmptyCard in every locale', kind => {
  const onChange = jest.fn()
  const child = kind === 'contacts' ? <SupplierContacts contacts={[]} disabled={false} onChange={onChange} />
    : <SupplierForm siteId={siteId} value={emptySupplier} disabled={false} onChange={onChange} />
  const view = render(shell('en', child))
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expectEmptyCard(locale, 'partners.contacts.empty', true)
    // Existing detail contacts are edit-only; creation retains the add action (docs/SUPPLIER_DETAILS.md).
    if (kind === 'form') expect(screen.getByRole('button', { name: copy(locale, 'partners.contacts.add') })).toBeEnabled()
    else expect(screen.queryByRole('button', { name: copy(locale, 'partners.contacts.add') })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  }
  expect(fetch).not.toHaveBeenCalled()
  if (kind === 'form') {
    fireEvent.click(screen.getByRole('button', { name: copy('ja', 'partners.contacts.add') }))
    expect(onChange).toHaveBeenCalledWith({ ...emptySupplier, contacts: [{ name: '', email: '', phone: '', role: '', is_primary: true }] })
  }
})

test('populated contacts preserve missing-field text and do not render a collection empty card', () => {
  const contact: SupplierContact = { name: 'Original contact', email: '', phone: '', role: '', is_primary: true }
  const child = <SupplierContacts contacts={[contact]} disabled={false} onChange={jest.fn()} />
  const view = render(shell('en', child))
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.queryByRole('heading', { name: copy(locale, 'partners.contacts.empty') })).not.toBeInTheDocument()
    expect(screen.getByText(copy(locale, 'partners.contacts.noDetails')).tagName).toBe('P')
    expect(screen.getByText('Original contact')).toBeInTheDocument()
  }
  expect(fetch).not.toHaveBeenCalled()
})

test('no tender participants render a compact EmptyCard without changing supplier selection or identifiers', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/suppliers?')
    ? response({ suppliers: [] }) : response({ tender, publications: [], participants: [], site_slug: 'site-owned', portal_enabled: false }))
  const child = <TenderDetail id={tenderId} />
  const view = render(shell('en', child))
  await screen.findByRole('heading', { level: 2, name: tender.title })
  fireEvent.mouseDown(screen.getByRole('tab', { name: copy('en', 'workflow.common.suppliers') }), { button: 0, ctrlKey: false })
  await screen.findByRole('heading', { name: copy('en', 'workflow.tender.noSuppliers') })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expectEmptyCard(locale, 'workflow.tender.noSuppliers', true)
    expect(screen.getByPlaceholderText(copy(locale, 'workflow.tender.selectSupplier'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy(locale, 'workflow.tender.registerInvitation') })).toBeDisabled()
    expect(screen.getByRole('link', { name: copy(locale, 'workflow.tender.editWorkingVersion') })).toHaveAttribute('href', `/purchases/tenders/${tenderId}/edit`)
  }
  fireEvent.mouseDown(screen.getByRole('tab', { name: copy('ja', 'workflow.common.activity') }), { button: 0, ctrlKey: false })
  await screen.findByRole('heading', { name: copy('ja', 'workflow.tender.notPublished') })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expectEmptyCard(locale, 'workflow.tender.notPublished', true)
  }
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch).toHaveBeenCalledWith(`/api/procurement/tenders/${tenderId}?site_id=${siteId}`, expect.any(Object))
})

test('populated tender participants keep supplier links and status codes out of the empty presentation', async () => {
  jest.mocked(fetch).mockImplementation(async url => String(url).includes('/suppliers?') ? response({ suppliers: [] })
    : response({ tender, publications: [], participants: [{ id: 'participant-owned', supplier_id: 'supplier-owned', status: 'invited', suppliers: { name: 'Original supplier' } }], site_slug: 'site-owned', portal_enabled: false }))
  const child = <TenderDetail id={tenderId} />
  const view = render(shell('en', child))
  await screen.findByRole('heading', { level: 2, name: tender.title })
  fireEvent.mouseDown(screen.getByRole('tab', { name: copy('en', 'workflow.common.suppliers') }), { button: 0, ctrlKey: false })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.queryByRole('heading', { name: copy(locale, 'workflow.tender.noSuppliers') })).not.toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Original supplier' })
    expect(link).toHaveAttribute('href', '/suppliers/supplier-owned')
    expect(link.closest('li')).toHaveTextContent(copy(locale, 'values.invited'))
  }
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('no account credentials render the compact EmptyCard with upload still available across locales', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ credentials: [], assessment: { status: 'pending', reason: '' } }))
  const child = <CredentialManager />
  const view = render(shell('en', child))
  await screen.findByRole('heading', { name: copy('en', 'portal.credentials.empty') })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expectEmptyCard(locale, 'portal.credentials.empty', true)
    expect(screen.getByText(copy(locale, 'portal.credentials.storageHint'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy(locale, 'portal.credentials.upload') })).toBeEnabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  }
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/procurement/credentials', { cache: 'no-store' })
})

test('credential load failure is not a successful empty collection', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ error: 'Forbidden' }, 403))
  render(shell('en', <CredentialManager />))
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: copy('en', 'portal.credentials.empty') })).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('no catalog offers use compact EmptyCard instead of an empty table and preserve capability controls', async () => {
  jest.mocked(fetch).mockResolvedValue(response(catalog))
  const child = <ProcurementTab itemId="item-owned" siteId={siteId} />
  const view = render(shell('en', child))
  await screen.findByRole('heading', { name: copy('en', 'portal.catalog.empty') })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expectEmptyCard(locale, 'portal.catalog.empty', true)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: copy(locale, 'portal.catalog.enable') })).toBeChecked()
    expect(screen.getByRole('button', { name: copy(locale, 'portal.catalog.previousOffers') })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy(locale, 'portal.catalog.nextOffers') })).toBeDisabled()
  }
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(`/api/procurement/catalog/item-owned?site_id=${siteId}&offset=0`, expect.any(Object))
})

test('catalog refresh replaces the empty card with original offer data and supplier IDs', async () => {
  const offer = { id: 'offer-owned', supplier_id: 'supplier-owned', purchase_unit: 'Original carton', units_per_purchase_unit: 2,
    minimum_quantity: 1, lead_time_days: 3, currency: 'EUR', unit_price_minor: 500, valid_from: '2026-10-01',
    valid_until: '2030-10-01', terms: 'Original commercial terms', created_at: '2026-10-01T12:00:00Z' }
  jest.mocked(fetch).mockResolvedValueOnce(response(catalog)).mockResolvedValueOnce(response({ ...catalog,
    offers: [offer], suppliers: [{ id: 'supplier-owned', name: 'Original supplier', status: 'approved' }], total: 1 }))
  render(shell('en', <ProcurementTab itemId="item-owned" siteId={siteId} />))
  await screen.findByRole('heading', { name: copy('en', 'portal.catalog.empty') })
  fireEvent.click(screen.getByRole('button', { name: copy('en', 'portal.catalog.refresh') }))
  const table = await screen.findByRole('table')
  expect(within(table).getByText('Original carton')).toBeInTheDocument()
  expect(within(table).getByText('Original commercial terms')).toBeInTheDocument()
  expect(within(table).getByRole('link', { name: 'Original supplier' })).toHaveAttribute('href', '/suppliers/supplier-owned')
  expect(screen.queryByRole('heading', { name: copy('en', 'portal.catalog.empty') })).not.toBeInTheDocument()
})

test('public search empty uses default-sized fancy EmptyCard with localized description and clear-search link', () => {
  const child = <EmptyTenders href="/tenders/site-owned" />
  const view = render(shell('en', child))
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    const card = expectEmptyCard(locale, 'portal.public.empty', false, 'portal.public.emptyHint')
    expect(within(card).getByRole('link', { name: copy(locale, 'portal.public.clearSearch') })).toHaveAttribute('href', '/tenders/site-owned')
  }
  expect(fetch).not.toHaveBeenCalled()
})

test('public listing filter empty uses default EmptyCard and show-all restores the original publication', async () => {
  const child = <TenderListing rows={[publication]} closedIds={[]} />
  const view = render(shell('en', child))
  fireEvent.click(screen.getAllByRole('button', { name: copy('en', 'portal.public.closed') })[0])
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    const card = expectEmptyCard(locale, 'portal.listing.noMatches', false)
    expect(within(card).getByRole('button', { name: copy(locale, 'portal.listing.showAll') })).toBeEnabled()
    expect(screen.queryByRole('link', { name: publication.snapshot.title })).not.toBeInTheDocument()
  }
  fireEvent.click(screen.getByRole('button', { name: copy('ja', 'portal.listing.showAll') }))
  await waitFor(() => expect(screen.getByRole('link', { name: publication.snapshot.title })).toHaveAttribute('href', `/tenders/site-owned/${tenderId}`))
  expect(screen.getByText(publication.snapshot.description)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: copy('ja', 'portal.listing.noMatches') })).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})