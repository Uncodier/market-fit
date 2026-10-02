import { act, renderHook } from '@testing-library/react'
import { useCommentReplySelection } from '@/app/hooks/useCommentReplySelection'
import type { ChatMessage } from '@/app/types/chat'

const firstId = '10000000-0000-4000-8000-000000000001'
const secondId = '10000000-0000-4000-8000-000000000002'
const metadata = { source: 'comment', outstand_post_id: 'post-a', platform_comment_id: 'provider-comment', network: 'instagram', publisher_account_id: 'account-a' }
const first: ChatMessage = { id: firstId, role: 'user', text: 'First comment', timestamp: new Date(), metadata }
const second: ChatMessage = { ...first, id: secondId, text: 'Second comment' }

it('requires explicit choice and does not auto-target the latest comment', () => {
  const { result } = renderHook(() => useCommentReplySelection('conversation', 'site', metadata, [first, second]))
  expect(result.current.isCommentConversation).toBe(true)
  expect(result.current.target).toBeUndefined()
  act(() => result.current.select(firstId))
  expect(result.current.target).toBe(first)
})

it('does not reuse another conversation or site selection during render', () => {
  const { result, rerender } = renderHook(({ conversation, site }) =>
    useCommentReplySelection(conversation, site, metadata, [first]),
  { initialProps: { conversation: 'a', site: 'site-a' } })
  act(() => result.current.select(firstId))
  rerender({ conversation: 'b', site: 'site-a' })
  expect(result.current.target).toBeUndefined()
  act(() => result.current.select(firstId))
  rerender({ conversation: 'b', site: 'site-b' })
  expect(result.current.target).toBeUndefined()
})

it('never retargets when a selected comment disappears or new comments arrive', () => {
  const { result, rerender } = renderHook(({ messages }) => useCommentReplySelection('a', 'site', metadata, messages),
    { initialProps: { messages: [first] } })
  act(() => result.current.select(firstId))
  rerender({ messages: [first, second] })
  expect(result.current.target).toBe(first)
  rerender({ messages: [second] })
  expect(result.current.target).toBeUndefined()
})

it('excludes DMs, team replies, optimistic rows and comments without provider IDs', () => {
  const messages: ChatMessage[] = [first, { ...first, id: 'temp-x' }, { ...second, role: 'team_member' },
    { ...second, metadata: { ...metadata, platform_comment_id: undefined } },
    { ...second, metadata: { ...metadata, source: 'outstand_dm' } }]
  const { result, rerender } = renderHook(({ custom }) => useCommentReplySelection('a', 'site', custom, messages),
    { initialProps: { custom: metadata } })
  expect(result.current.options).toEqual([first])
  rerender({ custom: { ...metadata, source: 'outstand_dm' } })
  expect(result.current.isCommentConversation).toBe(false)
  expect(result.current.options).toEqual([])
})