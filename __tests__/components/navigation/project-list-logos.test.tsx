import { act, render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '@/app/components/auth/auth-context'
import { useDirectoryLogos } from '@/app/context/use-project-list-logos'
import type { Site } from '@/app/context/site-types'
import { readProjectLogos } from '@/lib/sites/logo-background-sync'

const one = { id: 'one' } as Site, two = { id: 'two' } as Site
const sites = [one, two, { ...one, id: 'demo-x' }, { ...one, id: 'already-known', logo_url: null }]
const response = (actorId: string, logos: Record<string, string>) => ({ ok: true,
  json: async () => ({ success: true, actorId, logos }),
} as Response)
function Probe({ visible, list }: { visible: boolean; list: Site[] }) {
  const logos = useDirectoryLogos(list, visible)
  return <output>{JSON.stringify(logos ?? {})}</output>
}
function tree(visible: boolean, actor = 'a', list = sites) {
  return <AuthContext.Provider value={{ user: { id: actor }, isLoading: false } as AuthContextValue}>
    <Probe visible={visible} list={list} />
  </AuthContext.Provider>
}
beforeEach(() => jest.mocked(fetch).mockReset())

it('reads nothing for a closed directory and only its unknown visible IDs on demand', async () => {
  jest.mocked(fetch).mockResolvedValue(response('a', { one: 'fresh', other: 'unrequested' }))
  const view = render(tree(false))
  expect(fetch).not.toHaveBeenCalled()
  view.rerender(tree(true))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('fresh'))
  expect(screen.getByRole('status')).not.toHaveTextContent('unrequested')
  expect(fetch).toHaveBeenCalledWith('/api/sites/logos', expect.objectContaining({ body: JSON.stringify({ ids: ['one', 'two'] }), signal: expect.any(AbortSignal) }))
  view.rerender(tree(true, 'a', [...sites].reverse()))
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('retires an unread response on close, scope loss or account change and rejects a different server actor', async () => {
  let finish!: (value: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise(resolve => { finish = resolve })).mockResolvedValue(response('a', { one: 'wrong actor' }))
  const view = render(tree(true))
  const signal = jest.mocked(fetch).mock.calls[0][1]?.signal
  view.rerender(tree(false)); expect(signal?.aborted).toBe(true)
  await act(async () => finish(response('a', { one: 'late' })))
  view.rerender(tree(true, 'b'))
  await act(async () => {})
  expect(screen.getByRole('status').textContent).toBe('{}')
  jest.mocked(fetch).mockResolvedValue(response('b', { one: 'selected' }))
  view.rerender(tree(true, 'b', [one]))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('selected'))
  view.rerender(tree(true, 'b', []))
  expect(screen.getByRole('status').textContent).toBe('{}')
})

it('bounds requests and publishes no partial directory on a failed later batch', async () => {
  const ids = Array.from({ length: 51 }, (_, i) => `site-${i}`)
  jest.mocked(fetch).mockResolvedValueOnce(response('a', { 'site-0': 'first' })).mockResolvedValueOnce({ ok: false } as Response)
  await expect(readProjectLogos('a', ids, new AbortController().signal)).resolves.toEqual({})
  expect(jest.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)).ids.length)).toEqual([50, 1])
})