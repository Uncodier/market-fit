import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useChatOperations } from '@/app/hooks/useChatOperations'
import type { ChatMessage } from '@/app/types/chat'
import type { InterventionAcceptedResponse } from '@/app/services/intervention-request'
import { createConversation, sendAgentMessage, sendTeamMemberIntervention } from '@/app/services/chat-service'
import { InterventionRequestError, markInterventionMessageFailed } from '@/app/services/mark-intervention-message-failed'
import { toast } from 'react-hot-toast'

jest.mock('@/app/components/auth/auth-provider', () => ({
  useAuthContext: () => ({ user: { id: 'user-1', email: 'member@example.test' } }),
}))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site-1' } }) }))
jest.mock('@/app/services/chat-service', () => ({
  createConversation: jest.fn(),
  sendAgentMessage: jest.fn(),
  sendTeamMemberIntervention: jest.fn(),
}))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('@/app/services/mark-intervention-message-failed', () => ({
  ...jest.requireActual('@/app/services/mark-intervention-message-failed'),
  markInterventionMessageFailed: jest.fn(),
}))
jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn(), success: jest.fn() } }))

const accepted: InterventionAcceptedResponse = {
  success: true,
  data: {
    message: {
      message_id: 'message-1',
      content: 'Saved message',
      created_at: '2026-01-02T03:04:05.000Z',
      custom_data: { status: 'pending', channel: 'call' },
    },
  },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function setup(isAgentOnlyConversation = false, conversationId = 'conversation-1', isConversationReady = true) {
  return renderHook(() => {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [, setIsAgentResponding] = useState(false)
    const operations = useChatOperations({
      agentId: 'agent-1', agentName: 'Agent', conversationId,
      isAgentOnlyConversation, setChatMessages: setMessages, setIsAgentResponding,
      isConversationReady,
      leadData: { id: 'lead-1' },
    })
    return { ...operations, messages, setMessages }
  })
}

describe('useChatOperations send lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.mocked(markInterventionMessageFailed).mockResolvedValue(null)
  })

  afterEach(() => { jest.restoreAllMocks() })

  it('does not send through a stale internal mode before the current conversation is ready', async () => {
    const { result } = setup(true, 'loading-conversation', false)
    await act(async () => { expect(await result.current.handleSendMessage('Follow up')).toBe(false) })
    expect(sendAgentMessage).not.toHaveBeenCalled()
    expect(sendTeamMemberIntervention).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
  })

  it('reports a provider-accepted voice call as requested, not answered', async () => {
    jest.mocked(sendTeamMemberIntervention).mockResolvedValue({ ...accepted, data: { ...accepted.data,
      channel_send: { method: 'voice_agent_call', success: true, callId: 'call-1' },
    } })
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Greeting')).toBe(true) })
    expect(sendAgentMessage).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('does not confirm the recipient answered'))
  })

  it('reconciles an optimistic row with the accepted API ID without realtime', async () => {
    const response = deferred<InterventionAcceptedResponse>()
    jest.mocked(sendTeamMemberIntervention).mockReturnValue(response.promise)
    const { result } = setup()
    let send!: Promise<boolean>

    act(() => { send = result.current.handleSendMessage('Draft') })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.messages[0].id).toMatch(/^temp-/)
    await act(async () => {
      response.resolve(accepted)
      expect(await send).toBe(true)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.messages).toEqual([expect.objectContaining({
      id: 'message-1', text: 'Saved message', role: 'team_member',
      timestamp: new Date('2026-01-02T03:04:05.000Z'),
      metadata: { status: 'pending', channel: 'call' },
    })])
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
  })

  it.each([false, true])('preserves the realtime row when temporary row removed = %s', async removeTemporary => {
    const response = deferred<InterventionAcceptedResponse>()
    jest.mocked(sendTeamMemberIntervention).mockReturnValue(response.promise)
    const { result } = setup()
    let send!: Promise<boolean>
    act(() => { send = result.current.handleSendMessage('Draft') })
    const realtime: ChatMessage = {
      id: 'message-1', role: 'team_member', text: 'Realtime content', timestamp: new Date(),
      metadata: { status: 'delivered', command_status: 'success' },
    }
    act(() => {
      result.current.setMessages(previous => [...(removeTemporary ? [] : previous), realtime])
    })
    await act(async () => { response.resolve(accepted); await send })
    expect(result.current.messages).toEqual([realtime])
    expect(result.current.messages[0]).toBe(realtime)
  })

  it('reconciles the minimal accepted response containing only the persisted ID', async () => {
    jest.mocked(sendTeamMemberIntervention).mockResolvedValue({
      success: true, data: { message: { message_id: 'message-1' } },
    })
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(true) })
    expect(result.current.messages).toEqual([expect.objectContaining({
      id: 'message-1', text: 'Draft', sender_id: 'user-1', role: 'team_member',
    })])
    expect(result.current.messages[0].timestamp).toBeInstanceOf(Date)
  })

  it.each([
    ['network', new TypeError('Failed to fetch')],
    ['rejected', new InterventionRequestError('Forbidden')],
    ['unconfirmed', new InterventionRequestError('Call placement is unconfirmed')],
  ])('returns false for %s failure without persistence or automatic retry', async (_label, error) => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(error)
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Keep draft')).toBe(false) })
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
  })

  it.each([{ success: false }, {}])('does not consume an unconfirmed response: %j', async response => {
    jest.mocked(sendTeamMemberIntervention).mockResolvedValue(response)
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(false) })
    expect(result.current.messages).toEqual([])
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
  })

  it('shows the saved unconfirmed call without realtime while retaining the draft and never marking failure', async () => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('Call placement is unconfirmed', {
      saved_message_id: 'message-1',
    }))
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Keep draft')).toBe(false) })

    expect(result.current.messages).toEqual([expect.objectContaining({
      id: 'message-1', text: 'Keep draft', role: 'team_member',
      metadata: {
        voice_mode: 'agent_call', status: 'placement_unknown',
        call_status: 'placement_unknown', command_status: 'pending',
      },
    })])
    expect(result.current.isLoading).toBe(false)
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
  })

  it('consumes a deterministic saved failure only after its persisted row is confirmed', async () => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('No phone', {
      message_id: 'message-1',
    }))
    jest.mocked(markInterventionMessageFailed).mockResolvedValue({
      id: 'message-1', created_at: '2026-01-02T03:04:05.000Z',
      custom_data: { command_status: 'failed', error_message: 'No phone' },
    })
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(true) })
    expect(markInterventionMessageFailed).toHaveBeenCalledWith(expect.objectContaining({ messageId: 'message-1' }))
    expect(result.current.messages).toEqual([expect.objectContaining({
      id: 'message-1', text: 'Draft', metadata: { command_status: 'failed', error_message: 'No phone' },
    })])
  })

  it.each(['missing', 'rejected'])('retains draft if saved failure reconciliation is %s', async outcome => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('No phone', {
      message_id: 'message-1',
    }))
    if (outcome === 'rejected') jest.mocked(markInterventionMessageFailed).mockRejectedValue(new Error('Lookup failed'))
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(false) })
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('retains the draft if a saved failure has since advanced to unconfirmed placement', async () => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('No phone', {
      message_id: 'message-1',
    }))
    jest.mocked(markInterventionMessageFailed).mockResolvedValue({
      id: 'message-1', created_at: '2026-01-02T03:04:05.000Z',
      custom_data: { status: 'placement_unknown' },
    })
    const { result } = setup()
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(false) })
    expect(result.current.messages[0].metadata).toEqual({ status: 'placement_unknown' })
  })

  it('returns false for empty and in-flight sends, including two sends before a render', async () => {
    const response = deferred<InterventionAcceptedResponse>()
    jest.mocked(sendTeamMemberIntervention).mockReturnValue(response.promise)
    const { result } = setup()
    let send!: Promise<boolean>
    await act(async () => {
      expect(await result.current.handleSendMessage('   ')).toBe(false)
      send = result.current.handleSendMessage('First')
      expect(await result.current.handleSendMessage('Second')).toBe(false)
    })
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
    await act(async () => { response.resolve(accepted); await send })
  })

  it('keeps the draft when conversation creation fails', async () => {
    jest.mocked(createConversation).mockResolvedValue(null)
    const { result } = setup(false, 'new-conversation')
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(false) })
    expect(sendTeamMemberIntervention).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
  })

  it.each([true, false])('reports direct agent send acceptance = %s', async success => {
    if (success) jest.mocked(sendAgentMessage).mockResolvedValue({ success: true })
    else jest.mocked(sendAgentMessage).mockRejectedValue(new Error('Rejected'))
    const { result } = setup(true)
    await act(async () => { expect(await result.current.handleSendMessage('Draft')).toBe(success) })
    expect(sendTeamMemberIntervention).not.toHaveBeenCalled()
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
  })

  it('does not overwrite a realtime delivery update after an accepted manual retry', async () => {
    const response = deferred<InterventionAcceptedResponse>()
    jest.mocked(sendTeamMemberIntervention).mockReturnValue(response.promise)
    const { result } = setup()
    const failed: ChatMessage = {
      id: 'message-1', role: 'team_member', text: 'Draft', timestamp: new Date(),
      metadata: { command_status: 'failed' },
    }
    act(() => { result.current.setMessages([failed]) })
    let retry!: Promise<void>
    act(() => { retry = result.current.handleRetryMessage(failed) })
    const realtime = { ...failed, metadata: { command_status: 'success' as const, status: 'delivered' as const } }
    act(() => { result.current.setMessages([realtime]) })
    await act(async () => { response.resolve(accepted); await retry })
    expect(result.current.messages).toEqual([realtime])
    expect(sendTeamMemberIntervention).toHaveBeenCalledWith(
      'conversation-1', 'Draft', 'user-1', 'agent-1', expect.objectContaining({ message_id: 'message-1' }),
    )
  })

  it('uses the persisted retry status instead of fabricating failure after the row advanced', async () => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(new InterventionRequestError('No phone', {
      message_id: 'message-1',
    }))
    jest.mocked(markInterventionMessageFailed).mockResolvedValue({
      id: 'message-1', created_at: '2026-01-02T03:04:05.000Z',
      custom_data: { command_status: 'success', status: 'delivered' },
    })
    const { result } = setup()
    const failed: ChatMessage = {
      id: 'message-1', role: 'team_member', text: 'Draft', timestamp: new Date(),
      metadata: { command_status: 'failed' },
    }
    act(() => { result.current.setMessages([failed]) })
    await act(async () => { await result.current.handleRetryMessage(failed) })
    expect(result.current.messages[0].metadata).toEqual({ command_status: 'success', status: 'delivered' })
  })

  it.each([false, true])('restores a preflight-rejected retry only without a newer realtime update: %s', async updated => {
    let reject!: (error: Error) => void
    jest.mocked(sendTeamMemberIntervention).mockReturnValue(new Promise((_, fail) => { reject = fail }))
    const { result } = setup()
    const failed: ChatMessage = {
      id: 'message-1', role: 'team_member', text: 'Greeting', timestamp: new Date(),
      metadata: { command_status: 'failed', error_message: 'Existing failure' },
    }
    const realtime = { ...failed, metadata: { command_status: 'success' as const, status: 'delivered' as const } }
    act(() => { result.current.setMessages([failed]) })
    let retry!: Promise<void>
    act(() => { retry = result.current.handleRetryMessage(failed) })
    if (updated) act(() => { result.current.setMessages([realtime]) })
    await act(async () => {
      reject(new InterventionRequestError('No call started. Explicit consent is required.', { execution_started: false }))
      await retry
    })
    expect(result.current.messages).toEqual([updated ? realtime : failed])
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Explicit consent'))
    expect(result.current.isLoading).toBe(false)
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
  })

  it.each([
    new Error('Network unavailable'),
    new InterventionRequestError('Call placement is unconfirmed', { saved_message_id: 'message-1' }),
    new InterventionRequestError('Delivery could not be confirmed'),
  ])('keeps an ambiguous retry pending without failure marking or automatic replay: %s', async error => {
    jest.mocked(sendTeamMemberIntervention).mockRejectedValue(error)
    const { result } = setup()
    const failed: ChatMessage = {
      id: 'message-1', role: 'team_member', text: 'Greeting', timestamp: new Date(),
      metadata: { command_status: 'failed', error_message: 'Previous failure' },
    }
    act(() => { result.current.setMessages([failed]) })
    await act(async () => { await result.current.handleRetryMessage(failed) })
    expect(result.current.messages[0].metadata?.command_status).toBe('pending')
    expect(result.current.messages[0].metadata?.error_message).toBeUndefined()
    expect(markInterventionMessageFailed).not.toHaveBeenCalled()
    expect(sendTeamMemberIntervention).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(false)
  })
})