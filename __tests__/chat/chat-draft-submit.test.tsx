import { act, renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useChatDraftSubmit } from '@/app/chat/useChatDraftSubmit'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import { inputCacheStorageKey } from '@/app/hooks/optimized-message-state-utils'

jest.mock('react-hot-toast', () => ({ toast: { error: jest.fn() } }))

const submitEvent = () => ({ preventDefault: jest.fn() }) as unknown as React.FormEvent

function setup(handleSendMessage: (message: string) => Promise<boolean>) {
  return renderHook(({ conversationId }) => {
    const draft = useOptimizedMessageState('', `chat-${conversationId}`)
    const userJustSentRef = useRef(false)
    const submit = useChatDraftSubmit({
      conversationId, messageRef: draft.messageRef, clearMessage: draft.clearMessage,
      handleSendMessage, userJustSentRef,
    })
    return { ...draft, submit }
  }, { initialProps: { conversationId: 'conversation-1' } })
}

describe('chat draft submission', () => {
  beforeEach(() => { window.localStorage.clear() })

  it('retains the live and cached draft when the send handler catches a failure and resolves false', async () => {
    const send = jest.fn().mockResolvedValue(false)
    const { result } = setup(send)
    act(() => { result.current.setMessage('  Unsaved draft  ') })
    await act(async () => { await result.current.submit(submitEvent()) })

    expect(send).toHaveBeenCalledWith('Unsaved draft')
    expect(result.current.messageRef.current).toBe('  Unsaved draft  ')
    expect(result.current.message).toBe('  Unsaved draft  ')
    expect(window.localStorage.getItem(inputCacheStorageKey('chat-conversation-1'))).toBe(JSON.stringify('  Unsaved draft  '))
  })

  it('retains the draft when an unexpected send rejection escapes', async () => {
    const { result } = setup(jest.fn().mockRejectedValue(new Error('Unknown outcome')))
    act(() => { result.current.setMessage('Keep me') })
    await act(async () => { await result.current.submit(submitEvent()) })
    expect(result.current.messageRef.current).toBe('Keep me')
  })

  it('clears the live and cached draft only after explicit confirmation', async () => {
    const { result } = setup(jest.fn().mockResolvedValue(true))
    act(() => { result.current.setMessage('Accepted draft') })
    await act(async () => { await result.current.submit(submitEvent()) })
    expect(result.current.messageRef.current).toBe('')
    expect(window.localStorage.getItem(inputCacheStorageKey('chat-conversation-1'))).toBeNull()
  })

  it('fails closed if a legacy void handler resolves without confirmation', async () => {
    const { result } = setup(jest.fn().mockResolvedValue(undefined))
    act(() => { result.current.setMessage('Unconfirmed draft') })
    await act(async () => { await result.current.submit(submitEvent()) })
    expect(result.current.messageRef.current).toBe('Unconfirmed draft')
  })

  it('does not clear a newer draft after a slow accepted send', async () => {
    let resolve!: (value: boolean) => void
    const { result } = setup(() => new Promise<boolean>(done => { resolve = done }))
    act(() => { result.current.setMessage('First draft') })
    let submit!: Promise<void>
    act(() => { submit = result.current.submit(submitEvent()) })
    act(() => { result.current.setMessage('Newer draft') })
    await act(async () => { resolve(true); await submit })
    expect(result.current.messageRef.current).toBe('Newer draft')
  })

  it('does not clear another conversation with the same draft text', async () => {
    let resolve!: (value: boolean) => void
    const { result, rerender } = setup(() => new Promise<boolean>(done => { resolve = done }))
    act(() => { result.current.setMessage('Same text') })
    let submit!: Promise<void>
    act(() => { submit = result.current.submit(submitEvent()) })
    rerender({ conversationId: 'conversation-2' })
    act(() => { result.current.setMessage('Same text') })
    await act(async () => { resolve(true); await submit })
    expect(result.current.messageRef.current).toBe('Same text')
    expect(window.localStorage.getItem(inputCacheStorageKey('chat-conversation-2'))).toBe(JSON.stringify('Same text'))
  })

  it('does not send an empty draft', async () => {
    const send = jest.fn().mockResolvedValue(true)
    const { result } = setup(send)
    act(() => { result.current.setMessage('  ') })
    await act(async () => { await result.current.submit(submitEvent()) })
    expect(send).not.toHaveBeenCalled()
  })
})