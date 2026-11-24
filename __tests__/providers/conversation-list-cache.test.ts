import { unstable_serialize } from 'swr'
import { createConversationListCache } from '@/app/providers/conversation-list-cache'

const tuple = ['conversations', 'site', 'all', '', 'actor']
const key = unstable_serialize(tuple)
const entry = { _k: tuple, data: { items: ['private row'], denial: undefined } }

it.each(['resolved denial', 'thrown denial'])('a %s on another filter retires all warm views', mode => {
  const scope = createConversationListCache('actor', 'site')
  const first = scope.provider()
  first.set(key, entry)
  const next = scope.provider()
  expect(next.get(key)).toEqual(entry)
  const search = [...tuple]; search[3] = 'client'
  next.set(unstable_serialize(search), mode === 'resolved denial'
    ? { _k: search, data: { denial: { status: 403 } } }
    : { _k: search, error: { status: 403 }, data: entry.data })
  first.set(key, entry) // Late completion from the old route.
  expect(next.get(key)).toBeUndefined()
  expect([...scope.provider().keys()]).toEqual([])
})

it('copies only the matching list projection, never a cleared entry or in-flight state', () => {
  const scope = createConversationListCache('actor', 'site')
  const route = scope.provider()
  for (const tuple of [['conversations', 'other', 'all', '', 'actor'], ['conversations', 'site', 'all', '', 'other'], ['orders', 'site']]) {
    route.set(unstable_serialize(tuple), { ...entry, _k: tuple })
  }
  route.set(key, { ...entry, isValidating: true, isLoading: false })
  const next = scope.provider()
  expect([...next.entries()]).toEqual([[key, entry]])
  next.set(key, { _k: tuple, data: undefined })
  expect([...scope.provider().keys()]).toEqual([])
})
