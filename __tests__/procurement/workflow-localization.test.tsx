import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { LocalizationProvider, type SupportedLocale } from '@/app/context/LocalizationContext'
import { rawLocaleMessages } from '@/app/context/locale-catalog'
import { RequestList } from '@/app/purchases/requests/request-list'
import { RequestEditor } from '@/app/purchases/requests/request-editor'
import { RequestDetail } from '@/app/purchases/requests/request-detail'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import { TenderEditor } from '@/app/purchases/tenders/tender-editor'
import { TenderDetail } from '@/app/purchases/tenders/tender-detail'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'
import { WorkflowSnapshot } from '@/app/purchases/requests/workflow-snapshot'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'

const site = '00000000-0000-4000-8000-000000000001'
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: site, name: "Test workspace" } }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
// Keep the real localization provider, shared choices, data effects and form validation.
jest.mock('@/app/purchases/procurement/components/reference-picker', () => ({ ReferencePicker: () => null }))
const locales: SupportedLocale[] = ['en', 'es', 'fr', 'de', 'ja']
const copy = (locale: SupportedLocale, suffix: string) => rawLocaleMessages[locale][`procurement.workflow.${suffix}`]
const value = (locale: SupportedLocale, code: string) => rawLocaleMessages[locale][`procurement.values.${code}`]
function shell(locale: SupportedLocale, child: React.ReactNode) {
  return <LocalizationProvider preferredLocale={locale}><TopBarPrimaryActionsSlot />{child}</LocalizationProvider>
}
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => {
  localStorage.clear()
  jest.mocked(fetch).mockReset()
  Object.defineProperty(global.crypto, 'randomUUID', { configurable: true, value: () => site })
})

test('every workflow locale is registered with own translations and interpolation parity', () => {
  const english = rawLocaleMessages.en
  const keys = Object.keys(english).filter(key => key.startsWith('procurement.workflow.'))
  expect(keys.length).toBeGreaterThan(250)
  for (const locale of locales) {
    const dictionary = rawLocaleMessages[locale]
    expect(Object.keys(dictionary).filter(key => key.startsWith('procurement.workflow.')).sort()).toEqual(keys.sort())
    for (const key of keys) {
      expect(dictionary[key]?.trim()).toBeTruthy()
      expect(dictionary[key].match(/\{\{\w+\}\}/g)?.sort() ?? []).toEqual(english[key].match(/\{\{\w+\}\}/g)?.sort() ?? [])
    }
    if (locale !== 'en') expect(copy(locale, 'request.listDescription')).not.toEqual(copy('en', 'request.listDescription'))
  }
})

test.each(['request', 'tender'] as const)('%s list switches all five locales without loading data again', async kind => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ requests: [{ id: site, title: 'Saved user title', revision: 2, status: 'draft', currency: 'EUR', net_amount_minor: 123456, updated_at: '2026-10-27T12:00:00Z', tenders: [] }],
    tenders: [{ id: site, title: 'Saved user title', version: 2, status: 'draft', currency: 'EUR', net_amount_minor: 123456, participation_deadline: '2026-10-27T12:00:00Z' }], count: 1, can_manage: true }) } as Response)
  const child = kind === 'request' ? <RequestList /> : <TenderList />
  const view = render(shell('en', child))
  await screen.findByRole('link', { name: 'Saved user title' })
  const calls = jest.mocked(fetch).mock.calls.length
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('columnheader', { name: copy(locale, 'common.netAmount') })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent(value(locale, 'draft'))
    expect(screen.getByRole('table')).toHaveTextContent(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.56).replace(/\s/g, ' '))
    expect(screen.getAllByPlaceholderText(copy(locale, `${kind}.search`)).length).toBeGreaterThan(0)
    expect(screen.getByRole('table')).toHaveTextContent((new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date('2026-10-27T12:00:00Z')) + (kind === 'tender' ? ', ' + new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date('2026-10-27T12:00:00Z')) : '')).replace(/\s/g, ' '))
    expect(screen.getByRole('link', { name: 'Saved user title' })).toHaveAttribute('href', `/purchases/${kind === 'request' ? 'requests' : 'tenders'}/${site}`)
    expect(fetch).toHaveBeenCalledTimes(calls)
  }
})

test('known API errors change display language without a retry or fabricated empty state', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({ error: 'Unable to load requests' }) } as Response)
  const view = render(shell('en', <RequestList />))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load requests')
  const calls = jest.mocked(fetch).mock.calls.length
  for (const locale of locales.slice(1)) {
    view.rerender(shell(locale, <RequestList />))
    expect(screen.getByRole('alert')).not.toHaveTextContent('Unable to load requests')
    expect(screen.queryByText(copy(locale, 'request.empty'))).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(calls)
  }
})

test('request submit notice, immutable revision and progression survive all locale switches', async () => {
  const request = { id: site, title: 'Saved request', description: 'Original description', revision: 3, status: 'draft', currency: 'EUR', net_amount_minor: 1000, resolved_plan: null }
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? {} : { request, can_manage: true, actor_id: site, items: [], stages: [], audit: [] } }) as Response)
  const view = render(shell('en', <RequestDetail id={site} />))
  await screen.findByText('Original description')
  fireEvent.click(screen.getByRole('button', { name: copy('en', 'request.submit') }))
  await screen.findByText(copy('en', 'request.saved'))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3))
  for (const locale of locales) {
    view.rerender(shell(locale, <RequestDetail id={site} />))
    expect(screen.getByText(copy(locale, 'request.saved'))).toBeInTheDocument()
    expect(screen.getAllByText(value(locale, 'draft')).length).toBeGreaterThan(0)
    expect(screen.getByText('Original description')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy(locale, 'request.submit') })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  }
  const mutation = jest.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(mutation[0]).toBe(`/api/procurement/requests/${site}/submit?site_id=${site}`)
  expect(mutation[1]?.body).toBe(JSON.stringify({ expected_revision: 3 }))
})

test('tender pending-publication notice and working terms switch locale without publication replay', async () => {
  const tender = { id: site, title: 'Saved tender', status: 'draft', version: 2, visibility: 'private', global_visible: false, currency: 'EUR', net_amount_minor: 0,
    participation_deadline: '2090-01-01T00:00:00Z', opening_at: '2090-01-02T00:00:00Z', requirements: [] }
  jest.mocked(fetch).mockImplementation(async (url, init) => ({ ok: true, json: async () => init?.method === 'POST' ? { status: 'pending' }
    : String(url).includes('/suppliers?') ? { suppliers: [] } : { tender, publications: [], participants: [], site_slug: site, portal_enabled: false } }) as Response)
  const view = render(shell('en', <TenderDetail id={site} />))
  fireEvent.click(await screen.findByRole('button', { name: copy('en', 'tender.requestPublication') }))
  await screen.findByText(copy('en', 'tender.publicationPending'))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5))
  for (const locale of locales) {
    view.rerender(shell(locale, <TenderDetail id={site} />))
    expect(screen.getByText(copy(locale, 'tender.publicationPending'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy(locale, 'tender.requestPublication') })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Saved tender', level: 2 })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(5)
  }
  const mutation = jest.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(mutation[1]?.body).toBe(JSON.stringify({ expected_version: 2 }))
})

test('service validation persists all schema issues, translates field paths, and preserves save payload', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ taxes: [] }) } as Response)
  const save = jest.fn(async () => undefined)
  const initial = { title: 'Saved title', description: 'User description', currency: 'EUR' as const,
    lines: [{ catalog_item_id: null, description: '', quantity: 0, unit_estimate_minor: 100 }] }
  const child = <RequestEditor siteId={site} initial={initial} busy={false} onSave={save} />
  const view = render(shell('en', child))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  fireEvent.submit(screen.getByRole('button', { name: copy('en', 'request.saveDraft') }).closest('form')!)
  expect(screen.getByRole('alert').querySelectorAll('li').length).toBeGreaterThanOrEqual(3)
  for (const locale of locales) {
    view.rerender(shell(locale, child))
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'common.quantity'))
    expect(screen.getByLabelText(copy(locale, 'common.title'))).toHaveValue('Saved title')
    if (locale !== 'en') expect(screen.getByRole('alert')).not.toHaveTextContent('Explicit tax selection is required')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(save).not.toHaveBeenCalled()
  }
  fireEvent.change(screen.getByLabelText(copy('ja', 'request.serviceDescription')), { target: { value: 'User service' } })
  fireEvent.change(screen.getByLabelText(copy('ja', 'common.quantity')), { target: { value: '2' } })
  fireEvent.click(screen.getByLabelText(copy('ja', 'service.noTaxes')))
  fireEvent.click(screen.getByRole('button', { name: copy('ja', 'request.saveDraft') }))
  await waitFor(() => expect(save).toHaveBeenCalledWith({ title: 'Saved title', description: 'User description', currency: 'EUR',
    lines: [{ catalog_item_id: null, description: 'User service', quantity: 2, unit_estimate_minor: 100, tax_ids: [] }] }))
})

test('tender form translates choices and errors without reloading approved requests or changing defaults', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ requests: [] }) } as Response)
  const view = render(shell('en', <TenderEditor />))
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  fireEvent.submit(screen.getByRole('button', { name: copy('en', 'tender.saveWorkingVersion') }).closest('form')!)
  for (const locale of locales) {
    view.rerender(shell(locale, <TenderEditor />))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(copy(locale, 'tender.create'))
    expect(screen.getByRole('combobox', { name: copy(locale, 'tender.visibility') })).toHaveTextContent(value(locale, 'private'))
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'common.title'))
    expect(screen.getByRole('alert')).toHaveTextContent(copy(locale, 'tender.requirementNumber').replace('{{number}}', '1'))
    expect(fetch).toHaveBeenCalledTimes(1)
  }
})

test('replenishment rules, persisted cases, queue states and validation switch without stock checks', async () => {
  const rule = { id: site, version: 2, name: 'Saved rule name', catalog_item_id: site, location_id: site,
    minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true }
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ rules: [rule], rule_count: 1, case_count: 1,
    cases: [{ id: 'case', rule_id: site, rule_name: 'Saved rule name', action: 'alert', quantity: 1234.5, observed_quantity: 1, request_id: null }],
    queue: [{ rule_id: site, generation: 2, evaluated_generation: 1, last_result: null, last_error: null }] }) } as Response)
  const view = render(shell('en', <ReplenishmentRules siteId={site} />))
  await screen.findByRole('table')
  for (const locale of locales) {
    view.rerender(shell(locale, <ReplenishmentRules siteId={site} />))
    expect(screen.getByRole('table')).toHaveTextContent(value(locale, 'pending'))
    expect(screen.getByRole('table')).toHaveTextContent(copy(locale, 'replenishment.createDraft'))
    expect(screen.getByRole('navigation', { name: copy(locale, 'replenishment.casePages') })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
  }
  fireEvent.click(screen.getByRole('button', { name: copy('ja', 'common.edit') }))
  fireEvent.change(screen.getByLabelText(copy('ja', 'replenishment.targetStock')), { target: { value: '1' } })
  fireEvent.submit(screen.getByRole('button', { name: copy('ja', 'replenishment.save') }).closest('form')!)
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(copy('ja', 'replenishment.targetStock'))
  view.rerender(shell('de', <ReplenishmentRules siteId={site} />))
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(copy('de', 'replenishment.targetStock'))
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('audit evidence localizes metadata while leaving all user content and IDs untouched', async () => {
  const snapshot = { id: site, title: 'English user title', reason: 'Original decision reason', status: 'approved', currency: 'EUR', net_amount_minor: 123456,
    created_at: '2026-10-27T12:00:00Z', resolved_plan: { source: 'general', status: 'blocked', issues: ['The effective fallback blocks progression until an explicit policy is configured.'] } }
  const view = render(shell('en', <WorkflowSnapshot value={snapshot} />))
  for (const locale of locales) {
    await act(async () => view.rerender(shell(locale, <WorkflowSnapshot value={snapshot} />)))
    expect(screen.getByText('English user title')).toBeInTheDocument()
    expect(screen.getByText('Original decision reason')).toBeInTheDocument()
    expect(screen.getByText(site)).toBeInTheDocument()
    expect(screen.getByText(value(locale, 'approved'))).toBeInTheDocument()
    expect(screen.getByText(copy(locale, 'snapshot.resolvedPlan'))).toBeInTheDocument()
    if (locale !== 'en') expect(screen.queryByText(snapshot.resolved_plan.issues[0])).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  }
})