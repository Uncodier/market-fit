import React from 'react'
import { TextDecoder } from 'node:util'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MessageInput } from '@/app/components/simple-messages-view/components/MessageInput'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'

const toast = jest.fn()
const getSession = jest.fn()
const originalTextDecoder = globalThis.TextDecoder
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: () => getSession() } }) }))
jest.mock('@/app/services/context-service', () => ({ contextService: { getContextData: async () => ({ records: [] }) } }))
jest.mock('@/app/components/simple-messages-view/hooks/pending-work', () => ({
  buildPendingWorkPayload: jest.fn(), enqueuePendingWork: jest.fn(),
}))
jest.mock('@/app/components/simple-messages-view/hooks/useAttachmentUpload', () => ({
  useAttachmentUpload: () => ({ uploadFile: jest.fn(), isUploading: false }),
}))
jest.mock('@/app/components/simple-messages-view/hooks/useRequirementStatus', () => ({
  useRequirementStatus: () => ({ requirementStatuses: [] }),
}))
jest.mock('@/app/components/simple-messages-view/components/ActivitySelector', () => ({ ActivitySelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/SkillSelector', () => ({ SkillSelector: () => null }))
jest.mock('@/app/components/simple-messages-view/components/MediaParametersToolbar', () => ({ MediaParametersToolbar: () => null }))
jest.mock('@/app/components/simple-messages-view/components/InstanceContextUsage', () => ({ InstanceContextUsage: () => null }))
jest.mock('@/app/components/ui/context-selector-modal', () => ({ ContextSelectorModal: () => null }))
jest.mock('@/app/components/context/context-mention-picker', () => ({ ContextMentionPicker: () => null }))

function Composer() {
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState('', 'stream-composer-test')
  const { handleSendMessage } = useMessageSending({
    activeRobotInstance: { id: 'instance' }, selectedActivity: 'ask', selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] }, messageRef, onClearMessage: clearMessage,
  })
  return <MessageInput
    message={message}
    selectedActivity="ask"
    selectedContext={{} as any}
    onMessageChange={setMessage}
    handleMessageChange={handleMessageChange}
    onActivityChange={jest.fn()}
    onContextChange={jest.fn()}
    onSubmit={handleSendMessage}
    disabled={false}
    placeholder="Type a message"
    textareaRef={textareaRef}
    imageParameters={{} as any}
    videoParameters={{} as any}
    audioParameters={{} as any}
    onImageParameterChange={jest.fn()}
    onVideoParameterChange={jest.fn()}
    onAudioParameterChange={jest.fn()}
    activeRobotInstance={{ id: 'instance' }}
    skillSelection={{ skill_mode: 'auto', skill_slugs: [] }}
    onSkillSelectionChange={jest.fn()}
  />
}

beforeEach(() => {
  window.localStorage.clear()
  jest.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
  // jsdom does not expose the stream decoder provided by browsers.
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: TextDecoder })
})

afterEach(() => {
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, value: originalTextDecoder })
})

function mockAssistantStream() {
  const pendingReads: Array<(result: { value: Uint8Array; done: boolean }) => void> = []
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: true, status: 200, headers: { get: () => 'text/event-stream' },
    body: { getReader: () => ({
      read: () => new Promise<{ value: Uint8Array; done: boolean }>(resolve => pendingReads.push(resolve)),
      cancel: async () => {}, releaseLock: () => {},
    }) },
  })
  return pendingReads
}

it.each(['Enter', 'Send'])('clears the /robots composer on a real SSE acceptance via %s, before completion', async method => {
  const pendingReads = mockAssistantStream()
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Review this' } })
  if (method === 'Enter') fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  else fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(pendingReads).toHaveLength(1))
  expect(fetch).toHaveBeenCalledWith('/api/robots/instance/assistant', expect.objectContaining({
    method: 'POST', body: expect.stringContaining('Review this'),
  }))
  expect(textarea.value).toBe('Review this')

  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  const valueAfterAcceptance = textarea.value
  expect(window.localStorage.getItem('input-cache-stream-composer-test')).toBeNull()
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: completed\ndata: {"type":"completed","success":true}\n\n'), done: false })
  })
  expect(valueAfterAcceptance).toBe('')
  expect(toast).not.toHaveBeenCalled()
})

it('preserves a new draft written while the assistant request is being admitted', async () => {
  const pendingReads = mockAssistantStream()
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'First request' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  fireEvent.change(textarea, { target: { value: 'New draft' } })
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  expect(textarea.value).toBe('New draft')
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: completed\ndata: {"type":"completed","success":true}\n\n'), done: false })
  })
  expect(textarea.value).toBe('New draft')
})

it('retains the /robots draft when the server rejects admission', async () => {
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: false, status: 409, headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({
      success: false, execution_started: false,
      error: { code: 'ASSISTANT_EXECUTION_BUSY', message: 'This assistant execution is already in progress' },
    }),
  })
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'Retry this' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Assistant is busy' })))
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(textarea.value).toBe('Retry this')
})