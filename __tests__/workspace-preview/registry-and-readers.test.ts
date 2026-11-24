/** @jest-environment node */
import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient } from '@/lib/supabase/client'
import { workspacePreviewRoute } from '@/app/workspace-preview/routes'
import { directoryPreview } from '@/app/workspace-preview/loaders/directories'
import { quotationsPreview } from '@/app/workspace-preview/loaders/finance'
import { WorkspacePreviewError } from '@/app/workspace-preview/types'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const siteId = 'a1000000-0000-4000-8000-000000000001', actorId = 'a2000000-0000-4000-8000-000000000002'
const input = () => ({ siteId, actorId, signal: new AbortController().signal })
const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const getUser = jest.fn()
beforeEach(() => {
  getUser.mockReset().mockResolvedValue({ data: { user: { id: actorId } }, error: null })
  transport.mockReset()
  jest.mocked(createClient).mockReturnValue(Object.assign(new PostgrestClient('https://local.invalid/rest/v1', { fetch: transport }), { auth: { getUser } }))
})
const directoryRoutes = [
  ['/campaigns','campaigns','campaigns','title'], ['/segments','segments','segments','name'], ['/assets','assets','assets','name'],
  ['/content','content','content','title'], ['/promotions','promotions','promotions','name'], ['/catalog','catalog','catalog_items','name'],
  ['/price-lists','priceLists','price_lists','name'], ['/catalog/modifier-groups','modifierGroups','modifier_groups','name'],
  ['/requirements','requirements','requirements','title'], ['/records','records','record_categories','name'], ['/agents','agentsConfiguration','agents','name'],
] as const
it.each(directoryRoutes)('%s uses its specific screen key and a single limited RLS label query', async (path, screen, table, label) => {
  const route = workspacePreviewRoute(path, '')!
  expect(route.screen).toBe(screen)
  transport.mockResolvedValueOnce(Response.json([{ id: 'row', label: 'Display', secret: 'never render' }]))
  await expect(directoryPreview(screen, input())).resolves.toEqual([{ id: 'row', label: 'Display' }])
  const [req, init] = transport.mock.calls[0], url = new URL(String(req))
  expect(url.pathname).toBe(`/rest/v1/${table}`)
  expect(url.searchParams.get('select')).toBe(`id,label:${label}`)
  expect(url.searchParams.get('site_id')).toBe(`eq.${siteId}`)
  expect(url.searchParams.get('limit')).toBe('12')
  expect(url.searchParams.get('order')).toContain('id.asc')
  if (path === '/catalog') expect(url.searchParams.get('status')).toBe('eq.active')
  expect(init?.method).toBe('GET'); expect(transport).toHaveBeenCalledTimes(1); expect(getUser).not.toHaveBeenCalled()
})
it.each([['/robots','workflows','mode=workflow'], ['/orders','orders',''], ['/inventory','inventory',''], ['/inventory/movements','inventoryMovements',''],
  ['/inventory/transfers','inventoryTransfers',''], ['/leads','leads',''], ['/deals','deals',''], ['/control-center','controlCenter',''],
  ['/quotations','quotations',''], ['/subscriptions','subscriptions',''], ['/bills','bills',''], ['/order-lines','orderLines',''],
  ['/reservations','reservations',''], ['/shipments','shipments',''], ['/suppliers','suppliers',''],
  ['/purchases/requests','purchaseRequests',''], ['/purchases/tenders','procurementTenders','']])('admits exactly %s for its own screen', (path, key, search) => {
  expect(workspacePreviewRoute(path, search)?.screen).toBe(key)
})
it.each([['/robots',''], ['/robots','mode=imprenta'], ['/robots','mode=workflow&instance=foo'], ['/robots','mode=workflow&mode=workflow'],
  ['/shop/a',''], ['/pos',''], ['/checkout',''], ['/settings',''], ['/buyer',''], ['/home',''], ['/projects',''], ['/dashboard','tab=sales'],
  ['/segments','artifact=true'], ['/leads','segment_id=a'], ['/catalog','status=archived'], ['/orders/a',''], ['/inventory/movements/a',''],
  ['/subscriptions','sort=oldest'], ['/subscriptions/a',''], ['/purchases/subscriptions',''], ['/buyer/subscriptions',''],
  ['/bills','locationId=a'], ['/bills/a',''], ['/vb/token',''], ['/order-lines','page=2'], ['/order-lines/a',''],
  ['/sales',''], ['/costs',''], ['/dashboard','tab=costs'], ['/experiments',''], ['/copywriting',''],
  ['/purchases/procurement/approvals',''], ['/inventory/minimums',''], ['/payments',''], ['/leads','siteId=other']])('does not run a general list on %s?%s', (path, query) => {
  expect(workspacePreviewRoute(path, query)).toBeUndefined()
})
it('reuses the original secured mixed-quotation RPC without emitting totals, customer data, or links', async () => {
  transport.mockResolvedValueOnce(Response.json({ count: 1, data: [{ id: 'quote', title: 'Request', total: 42, tender_url: 'private', lead: { email: 'hidden' } }] }))
  await expect(quotationsPreview(input())).resolves.toEqual([{ id: 'quote', label: 'Request' }])
  const [request, init] = transport.mock.calls[0]; const url = new URL(String(request))
  expect(url.pathname).toBe('/rest/v1/rpc/list_workspace_quotations'); expect(init?.method).toBe('GET')
  expect(url.searchParams.get('p_page_size')).toBe('12'); expect(url.searchParams.get('p_site')).toBe(siteId)
  getUser.mockResolvedValueOnce({ data: { user: { id: 'other' } }, error: null })
  await expect(quotationsPreview(input())).rejects.toEqual(new WorkspacePreviewError(true)); expect(transport).toHaveBeenCalledTimes(1)
})
it('never renders simulated or malformed data and does not turn denial into an empty directory', async () => {
  jest.mocked(createClient).mockReturnValueOnce({ _isDemo: true })
  await expect(directoryPreview('assets', input())).rejects.toBeInstanceOf(WorkspacePreviewError)
  expect(transport).not.toHaveBeenCalled()
  transport.mockResolvedValueOnce(Response.json({ code: '42501' }, { status: 403 }))
  await expect(directoryPreview('assets', input())).rejects.toMatchObject({ denied: true })
  transport.mockResolvedValueOnce(Response.json([{ id: 'abc', label: { secret: 1 } }]))
  await expect(directoryPreview('assets', input())).rejects.toBeInstanceOf(WorkspacePreviewError)
})