/** @jest-environment node */
import { createClient } from '@/lib/supabase/server'
import { getQuotation } from '@/app/quotations/actions'
import { getWorkspaceQuotation, listWorkspaceQuotations } from '@/app/quotations/workspace-read-actions'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/app/quotations/actions', () => ({ getQuotation: jest.fn() }))
const site = '00000000-0000-4000-8000-000000000001'
const id = '00000000-0000-4000-8000-000000000002'
const rpc = jest.fn()
const getUser = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as never)
  getUser.mockResolvedValue({ data: { user: { id: 'member' } }, error: null })
})

it('uses one paginated query for sales and company proposals', async () => {
  const rows = [{ id, purpose: 'procurement', tender_url: '/tenders/buyer/tender' }]
  rpc.mockResolvedValue({ data: { data: rows, count: 51 }, error: null })
  expect(await listWorkspaceQuotations({ siteId: site, page: 2, q: 'tender', sort: 'oldest' }))
    .toEqual({ data: rows, count: 51 })
  expect(rpc).toHaveBeenCalledWith('list_workspace_quotations', {
    p_site: site, p_status: 'all', p_search: 'tender', p_page: 2, p_page_size: 50, p_sort: 'oldest',
  })
})

it('rejects malformed filters before touching the database', async () => {
  for (const input of [{ siteId: 'other' }, { siteId: site, page: 0 }, { siteId: site, q: 'x'.repeat(201) },
    { siteId: site, status: 'unsafe' }, { siteId: site, pageSize: 101 }]) {
    expect(await listWorkspaceQuotations(input)).toEqual({ error: 'Invalid quotation filters' })
  }
  expect(createClient).not.toHaveBeenCalled()
})

it('requires authentication for listing and detail', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect(await listWorkspaceQuotations({ siteId: site })).toEqual({ error: 'Unauthorized' })
  expect(await getWorkspaceQuotation(site, id)).toEqual({ error: 'Unauthorized' })
  expect(rpc).not.toHaveBeenCalled()
})

it('uses only the authorized safe proposal DTO, never the sales detail query', async () => {
  const quote = { id, purpose: 'procurement', status: 'sent', items: [] }
  rpc.mockResolvedValue({ data: quote, error: null })
  expect(await getWorkspaceQuotation(site, id)).toEqual({ data: quote })
  expect(getQuotation).not.toHaveBeenCalled()
})

it('fails closed without sales fallback on permission/database errors', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private database detail' } })
  expect(await getWorkspaceQuotation(site, id)).toEqual({ error: 'Forbidden' })
  expect(await listWorkspaceQuotations({ siteId: site })).toEqual({ error: 'Forbidden' })
  expect(getQuotation).not.toHaveBeenCalled()
  rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'private database detail' } })
  expect(await getWorkspaceQuotation(site, id)).toEqual({ error: 'Unable to load quotation' })
})

it('retains sales detail under RLS and the selected workspace boundary', async () => {
  rpc.mockResolvedValue({ data: null, error: null })
  jest.mocked(getQuotation).mockResolvedValue({ data: { id, site_id: site, purpose: 'sales' } } as never)
  expect(await getWorkspaceQuotation(site, id)).toMatchObject({ data: { purpose: 'sales' } })
  jest.mocked(getQuotation).mockResolvedValue({ data: { id, site_id: id } } as never)
  expect(await getWorkspaceQuotation(site, id)).toEqual({ error: 'Quotation not found' })
  expect(await getWorkspaceQuotation(site, 'invalid')).toEqual({ error: 'Invalid quotation' })
})