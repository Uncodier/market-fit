/** @jest-environment node */

import { PostgrestClient } from '@supabase/postgrest-js'
import { createClient } from '@/lib/supabase/client'
import { dealsPreview, leadsPreview, tasksPreview } from '@/app/workspace-preview/loaders/crm'
import { PREVIEW_LIMIT, WorkspacePreviewError } from '@/app/workspace-preview/types'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const siteId = '10000000-0000-4000-8000-000000000001'
const actorId = '20000000-0000-4000-8000-000000000002'
const scope = () => ({ siteId, actorId, signal: new AbortController().signal })
const readers = [
  { table: 'leads', load: leadsPreview, label: 'name', order: 'created_at.desc,id.desc' },
  { table: 'deals', load: dealsPreview, label: 'name', order: 'created_at.desc,id.desc' },
  { table: 'tasks', load: tasksPreview, label: 'title', order: 'priority.desc,scheduled_date.asc,id.asc' },
]

// Exercise the installed PostgREST builder and shared response checks. No SDK
// authentication, network, database, or environment configuration is involved.
const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
beforeEach(() => {
  transport.mockReset()
  jest.mocked(createClient).mockReturnValue(new PostgrestClient('https://crm.example.invalid/rest/v1', { fetch: transport }))
})

it.each(readers)('$table issues one site-scoped GET and returns labels only', async ({ table, load, label, order }) => {
  const input = scope()
  transport.mockResolvedValueOnce(Response.json([
    { id: 'second', label: '  Second  ', email: 'private@example.invalid', metadata: { private: true } },
    { id: 'first', label: 'First' },
  ]))

  await expect(load(input)).resolves.toEqual([{ id: 'second', label: 'Second' }, { id: 'first', label: 'First' }])
  expect(transport).toHaveBeenCalledTimes(1)
  const [request, init] = transport.mock.calls[0]
  const url = new URL(String(request))
  expect(url.pathname).toBe(`/rest/v1/${table}`)
  expect(Object.fromEntries(url.searchParams)).toEqual({
    select: `id,label:${label}`, site_id: `eq.${siteId}`, order, limit: '12',
    ...(table === 'tasks' && { status: 'in.(pending,in_progress,completed,failed,canceled)' }),
  })
  expect(url.href).not.toContain(actorId)
  expect(init?.method).toBe('GET')
  expect(init?.signal).toBe(input.signal)
  expect(new Headers(init?.headers).get('Prefer') || '').not.toContain('count=')
})

it('shows an unnamed lead without using contact data as its label', async () => {
  transport.mockResolvedValueOnce(Response.json([{ id: '1', label: null, email: 'private@example.invalid' }]))
  await expect(leadsPreview(scope())).resolves.toEqual([{ id: '1', label: '—' }])
})

it.each(readers)('$table does not fabricate empty data for errors or use a demo client', async ({ load }) => {
  transport.mockResolvedValueOnce(Response.json({ code: '42501', message: 'private database details' }, { status: 403 }))
  await expect(load(scope())).rejects.toEqual(new WorkspacePreviewError(true))
  transport.mockResolvedValueOnce(Response.json({ code: '57014', message: 'private database details' }, { status: 503 }))
  await expect(load(scope())).rejects.toEqual(new WorkspacePreviewError())
  transport.mockResolvedValueOnce(Response.json([]))
  await expect(load(scope())).resolves.toEqual([])
  expect(transport).toHaveBeenCalledTimes(3)

  const from = jest.fn()
  jest.mocked(createClient).mockReturnValueOnce({ _isMock: true, _isDemo: true, from })
  await expect(load(scope())).rejects.toEqual(new WorkspacePreviewError())
  expect(from).not.toHaveBeenCalled()
})

it.each([
  { payload: null }, { payload: {} }, { payload: [null] }, { payload: [{ id: {}, label: 'Name' }] },
  { payload: [{ id: ' ', label: 'Name' }] }, { payload: [{ id: 'valid', label: { private: true } }] },
  { payload: Array.from({ length: PREVIEW_LIMIT + 1 }, (_, id) => ({ id: String(id), label: 'Name' })) },
])('rejects a malformed or oversized response (case $#)', async ({ payload }) => {
  transport.mockResolvedValueOnce(Response.json(payload))
  await expect(tasksPreview(scope())).rejects.toEqual(new WorkspacePreviewError())
})

it.each(readers)('$table honors cancellation before dispatch and after a late response', async ({ load }) => {
  const aborted = new AbortController()
  aborted.abort()
  await expect(load({ ...scope(), signal: aborted.signal })).rejects.toEqual(new WorkspacePreviewError())
  expect(transport).not.toHaveBeenCalled()

  const retired = new AbortController()
  transport.mockImplementationOnce(async () => {
    retired.abort()
    return Response.json([{ id: 'stale', label: 'Old workspace' }])
  })
  await expect(load({ ...scope(), signal: retired.signal })).rejects.toEqual(new WorkspacePreviewError())
  expect(transport).toHaveBeenCalledTimes(1)
})