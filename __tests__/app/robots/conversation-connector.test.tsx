import { act, renderHook, waitFor } from '@testing-library/react'
import { robotConnectorHint } from '@/lib/navigation/robot-connector-hint'
import { useConversationConnector } from '@/app/robots/use-conversation-connector'
import { useConnectorSelection } from '@/app/robots/use-connector-selection'
import { connectorRequest } from '@/app/connectors/connector-request'
import { useExternalMessageEvents } from '@/app/components/simple-messages-view/use-external-message-events'
import { mobileInstanceDetailHref, mobileInstanceListHref } from '@/app/robots/mobile-instance-navigation'

jest.mock('@/app/connectors/connector-request', () => ({
  ...jest.requireActual('@/app/connectors/connector-request'), connectorRequest: jest.fn(),
}))
const id = 'ab1a0a11-0000-4000-8000-000000000001'
const other = 'ab1a0a11-0000-4000-8000-000000000002'
const account = { id, display_name: 'Reporting', toolkit_slug: 'supabase', can_use: true, enabled: true, provider_status: 'ACTIVE', revocation_pending: false }
const request = jest.mocked(connectorRequest)
beforeEach(() => request.mockReset())

it('preserves only an exact selection through mobile instance navigation; invalid hints do not become ordinary turns', () => {
  const link = mobileInstanceListHref(`connector=${id.toUpperCase()}&activity=robot&query=run`)
  const href = mobileInstanceDetailHref(link.split('?')[1], 'inst')
  expect(robotConnectorHint(new URLSearchParams(href.split('?')[1]))).toBe(id)
  expect(href).not.toMatch(/query|activity/)
  for (const value of ['', 'supabase', `https://example.org`, `${id}&connector=${other}`]) {
    expect(robotConnectorHint(new URLSearchParams(`connector=${value}`))).toBeNull()
  }
  expect(robotConnectorHint(new URLSearchParams())).toBeUndefined()
})

it('waits for an instance in the active site and never reuses a verified selection across sites or users', async () => {
  request.mockResolvedValueOnce(account).mockResolvedValue({ ...account, id: other })
  const hook = renderHook(({ site, actor, instanceSite }) => useConversationConnector(id, site, actor, { id: 'instance', site_id: instanceSite }),
    { initialProps: { site: 'site-A', actor: 'actor-A', instanceSite: 'site-B' } })
  expect(request).not.toHaveBeenCalled()
  hook.rerender({ site: 'site-A', actor: 'actor-A', instanceSite: 'site-A' })
  await waitFor(() => expect(hook.result.current).toEqual({ id, name: 'Reporting', toolkit: 'supabase' }))
  expect(request).toHaveBeenCalledWith(`/api/connectors/connections/${id}?site_id=site-A`, expect.anything(), expect.anything())
  hook.rerender({ site: 'site-B', actor: 'actor-A', instanceSite: 'site-B' })
  expect(hook.result.current?.id).toBeUndefined()
  await waitFor(() => expect(hook.result.current?.notice).toContain('unavailable'))
  request.mockRejectedValueOnce(Error('offline'))
  hook.rerender({ site: 'site-B', actor: 'actor-B', instanceSite: 'site-B' })
  await waitFor(() => expect(hook.result.current?.notice).toContain('unavailable'))
  expect(hook.result.current?.id).toBeUndefined()
})

it('never submits a connector conversation through the automatic URL event (including an event already scheduled)', () => {
  jest.useFakeTimers()
  try {
    const submit = jest.fn(), draft = jest.fn()
    const hook = renderHook(({ linked }) => useExternalMessageEvents(draft, submit, linked), { initialProps: { linked: false } })
    const send = () => window.dispatchEvent(new CustomEvent('robot:send-query-from-url', { detail: { query: 'List tables' } }))
    send(); hook.rerender({ linked: true }); send()
    act(() => jest.runAllTimers())
    expect(draft).not.toHaveBeenCalled(); expect(submit).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it('verifies a manual selection, clears it on instance change, and preserves the deep-link mode', async () => {
  request.mockResolvedValue(account)
  const hook = renderHook(({ instance, hint }) => useConnectorSelection(hint, 'site', 'actor', { id: instance, site_id: 'site' }),
    { initialProps: { instance: 'one', hint: undefined as string | null | undefined } })
  act(() => hook.result.current.selectConnector(id))
  expect(hook.result.current.manualOnly).toBe(true)
  expect(hook.result.current.connector?.id).toBeUndefined()
  await waitFor(() => expect(hook.result.current.connector?.id).toBe(id))
  hook.rerender({ instance: 'two', hint: undefined })
  expect(hook.result.current.connector).toBeUndefined()
  hook.rerender({ instance: 'two', hint: null })
  expect(hook.result.current.connector?.notice).toContain('unavailable')
  act(() => hook.result.current.selectConnector())
  expect(hook.result.current.connector).toBeUndefined()
  expect(hook.result.current.manualOnly).toBe(true)
  hook.rerender({ instance: 'two', hint: id })
  await waitFor(() => expect(hook.result.current.connector?.id).toBe(id))
})

it('permits and verifies account selection before a new conversation exists', async () => {
  request.mockResolvedValue(account)
  const hook = renderHook(() => useConnectorSelection(undefined, 'site', 'actor'))
  expect(hook.result.current.canSelect).toBe(true)
  act(() => hook.result.current.selectConnector(id))
  expect(hook.result.current.connector?.id).toBeUndefined()
  await waitFor(() => expect(hook.result.current.connector).toMatchObject({ id, toolkit: 'supabase' }))
  expect(hook.result.current.manualOnly).toBe(true)
})