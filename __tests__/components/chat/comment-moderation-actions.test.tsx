import { act, renderHook } from '@testing-library/react'
import { useChatMessageActions } from '@/app/components/chat/use-chat-message-actions'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ChatMessage } from '@/app/types/chat'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/app/services/getConversationMessages.client', () => ({ getConversationMessages: jest.fn() }))

const metadata = { source: 'comment', status: 'accepted' as const, reply_to_message_id: 'parent', reply_to_comment_id: 'provider-parent' }
const message: ChatMessage = { id: 'reply', role: 'assistant', text: 'Answer', timestamp: new Date(), metadata }

function setup(savedMetadata: Record<string, unknown>, updatedRow: unknown = { id: 'reply' }) {
  const update = jest.fn()
  const eq = jest.fn()
  const chain = { select: jest.fn(), eq, single: jest.fn(), update, maybeSingle: jest.fn() }
  chain.select.mockReturnValue(chain)
  eq.mockReturnValue(chain)
  update.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data: { custom_data: savedMetadata }, error: null })
  chain.maybeSingle.mockResolvedValue({ data: updatedRow, error: null })
  jest.mocked(createClient).mockReturnValue({ from: () => chain } as unknown as ReturnType<typeof createClient>)
  const onMessagesUpdate = jest.fn()
  const hook = renderHook(() => useChatMessageActions({ chatMessages: [message], conversationId: 'conversation', leadData: null, onMessagesUpdate }))
  return { ...hook, update, eq, onMessagesUpdate }
}

beforeEach(() => jest.clearAllMocks())

it('returns accepted public reply to pending only if its exact metadata has not changed', async () => {
  const { result, update, eq, onMessagesUpdate } = setup(metadata)
  await act(async () => { await result.current.handleUndoAcceptMessage(message) })
  expect(eq).toHaveBeenCalledWith('custom_data', JSON.stringify(metadata))
  expect(eq).toHaveBeenCalledWith('conversation_id', 'conversation')
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ custom_data: { ...metadata, status: 'pending' } }))
  expect(onMessagesUpdate).toHaveBeenCalledWith([expect.objectContaining({ metadata: { ...metadata, status: 'pending' } })])
})

it.each(['sending', 'unknown', 'sent'])('does not erase a public delivery claim: %s', comment_delivery_status => {
  const { result, update, onMessagesUpdate } = setup({ ...metadata, comment_delivery_status })
  return act(async () => {
    await result.current.handleUndoAcceptMessage(message)
    expect(update).not.toHaveBeenCalled()
    expect(onMessagesUpdate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})

it('does not claim success when a concurrent delivery wins the metadata compare', async () => {
  const { result, onMessagesUpdate } = setup(metadata, null)
  const log = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    await act(async () => { await result.current.handleUndoAcceptMessage(message) })
    expect(onMessagesUpdate).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
  } finally { log.mockRestore() }
})