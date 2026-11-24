/** @jest-environment node */
import { createClient as createSdk } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { createDemoMockClient } from '@/lib/demo-data/mock-client'
import { getDemoData } from '@/lib/demo-data'
import { getConversationPage, getConversations } from '@/app/services/getConversations.client'
import type { ConversationListRow } from '@/app/services/conversations/conversation-list-query'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const makeRows = (length: number, pending: number): ConversationListRow[] => Array.from({ length }, (_, i) => ({
  id: `row-${i}`, title: `Conversation ${i}`, agent_id: null, lead_id: null, last_message_at: null,
  created_at: new Date((length - i) * 1000).toISOString(), channel: 'email', custom_data: {},
  status: i < pending ? 'pending' : 'active', latest_message: [],
  first_message: [{ role: i % 2 ? 'assistant' : 'visitor', created_at: '' }],
  visitor_messages: i % 3 ? [{ role: 'visitor' }] : [],
}))
const ids = (rows: { id: string }[]) => rows.map(r => r.id)
const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), { status, headers })
function sdk(transport: typeof fetch) {
  const client = createSdk('https://local-supabase.invalid', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport },
  })
  jest.mocked(createClient).mockReturnValue(client)
}
function server(rows: ConversationListRow[]) {
  const requests: { table: string; method: string; params: URLSearchParams; signal?: AbortSignal | null }[] = []
  const tasks = rows.slice(0, 21).map(row => ({ conversation_id: row.id }))
  sdk(async (url, init) => {
    const request = new URL(String(url))
    const table = request.pathname.split('/').at(-1)!
    const params = request.searchParams
    const method = init?.method ?? 'GET'
    requests.push({ table, method, params, signal: init?.signal })
    if (table === 'tasks') return json(tasks)
    if (table === 'messages') return json([])
    if (table !== 'conversations') throw new Error(`Unexpected table: ${table}`)
    let found = rows.filter(row =>
      (!params.has('status') || (params.get('status') === 'eq.pending' ? row.status === 'pending' : row.status !== 'pending')) &&
      (!params.has('title') || row.title?.toLowerCase().includes(params.get('title')!.slice('ilike.%'.length, -1))) &&
      (!params.has('leads.assignee_id') || row.leads?.assignee_id === params.get('leads.assignee_id')!.slice(3)) &&
      (!params.has('leads.status') || params.get('leads.status')!.includes(row.leads?.status ?? 'missing')) &&
      (!params.has('id') || params.get('id')!.slice(4, -1).split(',').includes(row.id)))
    if (method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-range': `*/${found.length}` } })
    const start = Number(params.get('offset') || 0)
    if (params.has('limit')) found = found.slice(start, start + Number(params.get('limit')))
    return json(found)
  })
  return requests
}

it.each([0, 5, 20, 25, 40, 47])('preserves 20-row offsets and lookahead across %i pending rows', async pending => {
  const rows = makeRows(47, pending)
  const requests = server(rows)
  const one = await getConversationPage({ siteId: 'site' })
  expect(ids(one.items)).toEqual(ids(rows.slice(0, 20)))
  expect(one.hasMore).toBe(true)
  const primary = requests.filter(r => r.table === 'conversations')
  expect(primary).toHaveLength(pending >= 21 ? 1 : 2)
  expect(primary.every(r => r.method === 'GET' && r.params.get('site_id') === 'eq.site')).toBe(true)
  expect(primary[0].params.get('latest_message.limit')).toBe('1')
  expect(primary[0].params.get('select')).toContain('latest_message:messages')
  expect(primary[0].params.get('order')).toContain('id.desc')
  // Do not enrich (or display) the sentinel, and use one deadline through enrichment.
  expect(requests.find(r => r.table === 'messages')!.params.get('conversation_id')).not.toContain('row-20')
  expect(requests.every(r => r.signal && r.signal === primary[0].signal)).toBe(true)
  const two = await getConversationPage({ siteId: 'site', page: 2 })
  const three = await getConversationPage({ siteId: 'site', page: 3 })
  expect(ids([...one.items, ...two.items, ...three.items])).toEqual(ids(rows))
  expect([two.hasMore, three.hasMore]).toEqual([true, false])
  expect(requests.filter(r => r.method === 'HEAD')).toHaveLength(2)
})

it.each([0, 1, 19, 20, 21])('reports a real next page rather than guessing from a %i-row initial result', async length => {
  server(makeRows(length, 3))
  const first = await getConversationPage({ siteId: 'site' })
  expect(first.items).toHaveLength(Math.min(length, 20))
  expect(first.hasMore).toBe(length > 20)
})

it.each(['visitor', 'agent', 'replied'] as const)('keeps the normal page stride after filtering by %s initiation', async initiatedByFilter => {
  const rows = makeRows(85, 9)
  const requests = server(rows)
  const expected = rows.filter((r, i) => initiatedByFilter === 'visitor' ? i % 2 === 0
    : i % 2 === 1 && (initiatedByFilter !== 'replied' || r.visitor_messages!.length > 0))
  const results = []
  for (let page = 1; page <= Math.ceil(expected.length / 20); page++) {
    const loaded = await getConversationPage({ siteId: 'site', initiatedByFilter, page })
    expect(loaded.hasMore).toBe(page * 20 < expected.length)
    results.push(...loaded.items)
  }
  expect(ids(results)).toEqual(ids(expected))
  expect(requests.filter(r => r.table === 'conversations').every(r => r.params.get('first_message.limit') === '1' && r.params.get('visitor_messages.limit') === '1')).toBe(true)
})

it.each(['assigned', 'qualified', 'tasks', 'search'] as const)('keeps lookahead, order and pagination within the %s projection', async mode => {
  const rows = makeRows(48, 9).map((row, i) => ({ ...row,
    title: `${i % 2 ? 'target' : 'other'} ${i}`, leads: { status: i % 2 ? 'qualified' : 'new', assignee_id: i % 2 ? 'me' : 'other' },
  }))
  const requests = server(rows)
  const filter = mode === 'assigned' ? { assigneeFilter: 'assigned' as const, currentUserId: 'me' }
    : mode === 'qualified' ? { qualifiedLeadsOnly: true } : mode === 'tasks' ? { tasksOnly: true } : { searchQuery: ' target ' }
  const expected = mode === 'tasks' ? rows.slice(0, 21) : rows.filter((_row, i) => i % 2)
  const one = await getConversationPage({ siteId: 'site', ...filter })
  const two = await getConversationPage({ siteId: 'site', ...filter, page: 2 })
  expect(ids([...one.items, ...two.items])).toEqual(ids(expected))
  expect([one.hasMore, two.hasMore]).toEqual([true, false])
  const primary = requests.filter(r => r.table === 'conversations')
  if (mode === 'assigned' || mode === 'qualified') expect(primary.every(r => r.params.get('select')!.includes('leads!inner'))).toBe(true)
  expect(primary.every(r => r.params.get('site_id') === 'eq.site' && r.params.get('is_archived') === 'eq.false')).toBe(true)
})

it.each([[403, '', 403], [401, 'PGRST301', 401], [500, '42501', 403], [503, '', 503], [400, '57014', 503], [400, '55P03', 503]])(
  'carries %i / %s safely through the real SDK without inventing an empty result', async (http, code, status) => {
    const transport = jest.fn(async () => json({ code, message: 'private database detail' }, Number(http)))
    sdk(transport)
    await expect(getConversations('site')).rejects.toMatchObject({ status, message: 'Unable to load conversations' })
    expect(transport).toHaveBeenCalledTimes(1)
  },
)

it('does not let the SDK reissue network failures in the background', async () => {
  const transport = jest.fn(async () => { throw new TypeError('network failed') })
  sdk(transport)
  await expect(getConversations('site')).rejects.toMatchObject({ status: 503 })
  expect(transport).toHaveBeenCalledTimes(1)
})

it('aborts timed-out transport without treating it as an empty success or silently retrying', async () => {
  jest.useFakeTimers()
  try {
    let signal: AbortSignal | null | undefined
    const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>((_url, init) => {
      signal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    })
    sdk(transport)
    const failure = expect(getConversations('site')).rejects.toHaveProperty('message', 'Unable to load conversations')
    await jest.advanceTimersByTimeAsync(12_000)
    await failure
    expect(signal?.aborted).toBe(true)
    expect(transport).toHaveBeenCalledTimes(1)
  } finally {
    jest.useRealTimers()
  }
})

it('rejects an unknown pending count instead of guessing an offset and skipping rows', async () => {
  const transport = jest.fn(async () => new Response(null, { status: 200 }))
  sdk(transport)
  await expect(getConversationPage({ siteId: 'site', page: 2 })).rejects.toMatchObject({ status: 503 })
  expect(transport).toHaveBeenCalledTimes(1)
})

it('uses the existing lazy demo client without requesting real credentials', async () => {
  const siteId = 'demo-saas-en-123'
  const client = createDemoMockClient(siteId)
  jest.mocked(createClient).mockReturnValue(client)
  const result = await getConversationPage({ siteId, pageSize: 1 })
  expect(result.items).toHaveLength(1)
  const seed = await getDemoData(siteId)
  expect(ids(seed?.conversations ?? [])).toContain(result.items[0].id)
})