import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LocalizationProvider, type SupportedLocale } from '@/app/context/LocalizationContext'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import { SupplierList } from '@/app/suppliers/components/supplier-list'
import { SupplierDetail } from '@/app/suppliers/components/supplier-detail'
import { SupplierActivity } from '@/app/suppliers/components/supplier-activity'
import { ProcurementOrdersPanel } from '@/app/purchases/procurement/commerce/ProcurementOrdersPanel'
import { ProcurementQuotesPanel } from '@/app/purchases/procurement/commerce/ProcurementQuotesPanel'
import { EventApprovals } from '@/app/purchases/procurement/approvals/event-approvals'
import ApprovalsPage from '@/app/purchases/procurement/approvals/page'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: site } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null }) }))
// Isolate unrelated child requests; the tested components retain real effects and localization.
jest.mock('@/app/suppliers/components/reference-picker', () => ({ SupplierReferencePicker: () => null }))
jest.mock('@/app/purchases/procurement/evidence/representative-manager', () => ({ RepresentativeManager: () => null }))
const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja']
const text = (locale: SupportedLocale, suffix: string) => rawLocaleMessages[locale][`procurement.partners.${suffix}`]
const value = (locale: SupportedLocale, code: string) => rawLocaleMessages[locale][`procurement.values.${code}`]
const interpolate = (text: string, params: Record<string, string | number>) => Object.entries(params).reduce((result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)), text)
function shell(locale: SupportedLocale, child: React.ReactNode) {
  return <LocalizationProvider preferredLocale={locale}><TopBarPrimaryActionsSlot />{child}</LocalizationProvider>
}
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
const supplier = { id, site_id: site, version: 1, name: 'Original supplier name', status: 'approved', company_id: null,
  contacts: [], category_ids: [], commercial_terms: 'Original Net 30', private_notes: 'Original private note',
  created_at: '2026-10-27T12:00:00Z', updated_at: '2026-10-27T12:00:00Z' }
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => { localStorage.clear(); jest.mocked(fetch).mockReset() })

test('partners own dictionaries cover all five locales with identical interpolation contracts', () => {
  const keys = Object.keys(rawLocaleMessages.en).filter(key => key.startsWith('procurement.partners.')).sort()
  expect(keys.length).toBeGreaterThanOrEqual(205)
  for (const locale of locales) {
    expect(Object.keys(rawLocaleMessages[locale]).filter(key => key.startsWith('procurement.partners.')).sort()).toEqual(keys)
    for (const key of keys) {
      const own = rawLocaleMessages[locale][key]
      expect(own.trim()).toBeTruthy()
      expect(own.match(/\{\{\w+\}\}/g)?.sort() ?? []).toEqual(rawLocaleMessages.en[key].match(/\{\{\w+\}\}/g)?.sort() ?? [])
    }
    if (locale !== 'en') expect(text(locale, 'suppliers.approvalHint')).not.toEqual(text('en', 'suppliers.approvalHint'))
  }
})

test('supplier directory updates actions, statuses and dates without querying again', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ suppliers: [supplier], total: 1, can_create: true }))
  const child = <SupplierList siteId={site} />
  const view = render(shell('en', child))
  await screen.findByRole('link', { name: supplier.name })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('button', { name: text(locale, 'suppliers.create') })).toBeEnabled()
    expect(screen.getByRole('tab', { name: value(locale, 'approved') })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: text(locale, 'suppliers.updated') })).toBeInTheDocument()
    expect(screen.getByText(new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(supplier.updated_at)))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: supplier.name })).toHaveAttribute('href', `/suppliers/${id}`)
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})

test('supplier validation issues and private contact drafts change language without saving', async () => {
  const child = <SupplierDetail siteId={site} id="new" />
  const view = render(shell('en', child))
  fireEvent.change(screen.getByLabelText(text('en', 'form.supplierName')), { target: { value: 'Original supplier name' } })
  fireEvent.click(screen.getByRole('button', { name: text('en', 'contacts.add') }))
  fireEvent.change(screen.getByLabelText(text('en', 'contacts.fields.name')), { target: { value: 'Original contact name' } })
  fireEvent.change(screen.getByLabelText(text('en', 'contacts.fields.email')), { target: { value: 'invalid-email' } })
  fireEvent.submit(screen.getByRole('button', { name: text('en', 'suppliers.create') }).closest('form')!)
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(text(locale, 'suppliers.create'))
    expect(screen.getByLabelText(text(locale, 'contacts.fields.name'))).toHaveValue('Original contact name')
    expect(screen.getByLabelText(text(locale, 'contacts.fields.email'))).toHaveValue('invalid-email')
    expect(screen.getByRole('alert')).toHaveTextContent(text(locale, 'contacts.fields.email'))
    if (locale !== 'en') expect(screen.getByRole('alert')).not.toHaveTextContent('Invalid email')
    expect(fetch).not.toHaveBeenCalled()
  }
})

test('supplier audit translates saved event metadata but does not request activity on locale changes', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ activity: [{ version: 2, action: 'updated', previous_status: 'prospect', status: 'approved', created_at: supplier.updated_at }] }))
  const child = <SupplierActivity siteId={site} id={id} version={2} />
  const view = render(shell('en', child))
  await screen.findByText(/Version 2/)
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByText(interpolate(text(locale, 'activity.versionAction'), { version: 2, action: value(locale, 'updated') }))).toBeInTheDocument()
    expect(screen.getByText(`${value(locale, 'prospect')} → ${value(locale, 'approved')}`)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})

test('quotation source, amount and external-record dialog update without repeating either read', async () => {
  const quote = { id, supplier_name: 'Original supplier name', reference: 'Original reference', tender_title: 'Original tender title',
    currency: 'EUR', net_amount_minor: 123456, source: 'supplier_submitted', award_id: null, recorded_at: supplier.updated_at, lines: [] }
  jest.mocked(fetch).mockImplementation(async url => response({ data: String(url).includes('/quotes?') ? [quote] : [] }))
  const child = <ProcurementQuotesPanel siteId={site} />
  const view = render(shell('en', child))
  const row = (await screen.findByText('Original supplier name')).closest('tr')!
  expect(row).toHaveTextContent('Original reference')
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(row).toHaveTextContent(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.56).replace(/\s/g, ' '))
    expect(row).toHaveTextContent(rawLocaleMessages[locale]['procurement.common.taxesPending'])
    expect(row).toHaveTextContent(text(locale, 'quotes.supplierSubmitted'))
    expect(row).toHaveTextContent(text(locale, 'quotes.notAwarded'))
    expect(fetch).toHaveBeenCalledTimes(2)
  }
  fireEvent.click(screen.getByRole('button', { name: text('ja', 'quotes.external') }))
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(text(locale, 'quotes.recordTitle'))
    expect(screen.getByText(text(locale, 'quotes.noTender'))).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(2)
  }
})

test('order acceptance dialog preserves entered data and localized validation without receipt writes', async () => {
  const order = { id, supplier_name: supplier.name, currency: 'USD', net_amount_minor: 123456, created_at: supplier.updated_at,
    lines: [{ id: 'line', name: 'Original service', quantity: 3, received_quantity: 1 }] }
  jest.mocked(fetch).mockResolvedValue(response({ data: [order] }))
  const child = <ProcurementOrdersPanel siteId={site} />
  const view = render(shell('en', child))
  fireEvent.click(await screen.findByRole('button', { name: text('en', 'orders.itemsAcceptance') }))
  fireEvent.change(screen.getByPlaceholderText(text('en', 'orders.quantityPlaceholder')), { target: { value: '1000001' } })
  fireEvent.change(screen.getByLabelText(text('en', 'orders.note')), { target: { value: 'Original acceptance note' } })
  fireEvent.submit(screen.getByRole('button', { name: text('en', 'orders.record') }).closest('form')!)
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByLabelText(text(locale, 'orders.note'))).toHaveValue('Original acceptance note')
    expect(screen.getByPlaceholderText(text(locale, 'orders.quantityPlaceholder'))).toHaveValue('1000001')
    expect(screen.getByRole('alert')).toHaveTextContent(text(locale, 'orders.quantityError'))
    expect(screen.getByRole('button', { name: text(locale, 'orders.record') })).toBeEnabled()
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})

test('approval decision dialog updates language without resubmitting or discarding the reason', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ approvals: [{ id, status: 'pending', event: 'award', target_version: 2,
    procurement_event_stages: [{ id: 'stage', status: 'pending', position: 0, definition: { name: 'Original stage name', decisionMode: 'human' } }] }] }))
  const child = <EventApprovals siteId={site} targetId={id} />
  const view = render(shell('en', child))
  fireEvent.click(await screen.findByRole('button', { name: text('en', 'approvals.approve') }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Original decision reason' } })
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName(text(locale, 'approvals.approveTitle'))
    expect(within(dialog).getByRole('textbox', { name: interpolate(text(locale, 'approvals.reasonFor'), { name: 'Original stage name' }) })).toHaveValue('Original decision reason')
    expect(within(dialog).getByRole('button', { name: text(locale, 'approvals.confirmDecision') })).toBeEnabled()
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})

test('approval inbox localizes stage filters and rows without another inbox request', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ rows: [{ id: 'request:1', target_id: id, stage: 'requisition', title: 'Original document title', status: 'pending', revision: 2, date: '2026-10-27' }], count: 1 }))
  const child = <ApprovalsPage />
  const view = render(shell('en', child))
  await screen.findByText('Original document title')
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('table', { name: text(locale, 'approvals.inboxTitle') })).toHaveTextContent(text(locale, 'approvals.stages.requisition'))
    expect(screen.getByRole('combobox', { name: text(locale, 'approvals.stageLabel') })).toHaveTextContent(text(locale, 'approvals.allStages'))
    expect(screen.getByRole('link', { name: text(locale, 'approvals.review') })).toHaveAttribute('href', `/purchases/requests/${id}`)
    expect(fetch).toHaveBeenCalledTimes(1)
  }
  await waitFor(() => expect(screen.getByText('Original document title')).toBeInTheDocument())
})