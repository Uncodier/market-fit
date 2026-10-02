import { act, renderHook } from '@testing-library/react'
import { useCommentReplySelection } from '@/app/hooks/useCommentReplySelection'
import type { ChatMessage } from '@/app/types/chat'

const firstId = '10000000-0000-4000-8000-000000000001'
const secondId = '10000000-0000-4000-8000-000000000002'
const metadata = { source: 'comment', outstand_post_id: 'post-a', platform_comment_id: 'provider-comment', network: 'instagram', publisher_account_id: 'account-a' }
const first: ChatMessage = { id: firstId, role: 'user', text: 'First comment', timestamp: new Date('2026-10-01T10:00:00Z'), metadata }
const second: ChatMessage = { ...first, id: secondId, text: 'Second comment', timestamp: new Date('2026-10-01T11:00:00Z') }

it('preselects the latest replyable comment by timestamp, not timeline position', () => {
  const messages = [second, first]
  const { result } = renderHook(() => useCommentReplySelection('conversation', 'site', metadata, messages))
  expect(result.current.isCommentConversation).toBe(true)
  expect(result.current.target).toBe(second)
  expect(result.current.options).toEqual([second, first])
  expect(messages).toEqual([second, first])
  act(() => result.current.select(firstId))
  expect(result.current.target).toBe(first)
})

it('sorts picker options newest first without changing the original timeline', () => {
  const messages = [first, second]
  const { result } = renderHook(() => useCommentReplySelection('conversation', 'site', metadata, messages))
  expect(result.current.options).toEqual([second, first])
  expect(result.current.target).toBe(second)
  expect(messages).toEqual([first, second])
})

it('resets the default instead of reusing another conversation or site selection', () => {
  const { result, rerender } = renderHook(({ conversation, site }) =>
    useCommentReplySelection(conversation, site, metadata, [first, second]),
  { initialProps: { conversation: 'a', site: 'site-a' } })
  act(() => result.current.select(firstId))
  rerender({ conversation: 'b', site: 'site-a' })
  expect(result.current.target).toBe(second)
  act(() => result.current.select(firstId))
  rerender({ conversation: 'b', site: 'site-b' })
  expect(result.current.target).toBe(second)
})

it('preselects once comments arrive after an empty loading state', () => {
  const { result, rerender } = renderHook(({ messages }) => useCommentReplySelection('a', 'site', metadata, messages),
    { initialProps: { messages: [] as ChatMessage[] } })
  expect(result.current.target).toBeUndefined()
  rerender({ messages: [first, second] })
  expect(result.current.target).toBe(second)
})

it('does not restore an old manual selection after navigating away through an empty state', () => {
  const { result, rerender } = renderHook(({ conversation, messages }) =>
    useCommentReplySelection(conversation, 'site', metadata, messages),
  { initialProps: { conversation: 'a', messages: [first, second] } })
  act(() => result.current.select(firstId))
  rerender({ conversation: 'b', messages: [] })
  expect(result.current.target).toBeUndefined()
  rerender({ conversation: 'a', messages: [first, second] })
  expect(result.current.target).toBe(second)
})

it.each([false, true])('never retargets a disappeared comment or new arrival (manual selection: %s)', manual => {
  const { result, rerender } = renderHook(({ messages }) => useCommentReplySelection('a', 'site', metadata, messages),
    { initialProps: { messages: [first] } })
  if (manual) act(() => result.current.select(firstId))
  rerender({ messages: [first, second] })
  expect(result.current.target).toBe(first)
  rerender({ messages: [second] })
  expect(result.current.target).toBeUndefined()
  act(() => result.current.select(secondId))
  expect(result.current.target).toBe(second)
})

it('keeps the latest valid timestamp ahead of malformed dates', () => {
  const invalidDate = { ...first, timestamp: new Date('invalid') }
  const { result } = renderHook(() => useCommentReplySelection('a', 'site', metadata, [invalidDate, second]))
  expect(result.current.target).toBe(second)
})

it('excludes DMs, team replies, optimistic rows and comments without provider IDs', () => {
  const messages: ChatMessage[] = [first, { ...first, id: 'temp-x' }, { ...second, role: 'team_member' },
    { ...second, metadata: { ...metadata, platform_comment_id: undefined } },
    { ...second, metadata: { ...metadata, source: 'outstand_dm' } }]
  const { result, rerender } = renderHook(({ custom }) => useCommentReplySelection('a', 'site', custom, messages),
    { initialProps: { custom: metadata } })
  expect(result.current.options).toEqual([first])
  expect(result.current.target).toBe(first)
  rerender({ custom: { ...metadata, source: 'outstand_dm' } })
  expect(result.current.isCommentConversation).toBe(false)
  expect(result.current.options).toEqual([])
  expect(result.current.target).toBeUndefined()
})