import React, { useLayoutEffect, useRef } from 'react'
import { TextDecoder } from 'node:util'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MessageInput } from '@/app/components/simple-messages-view/components/MessageInput'
import { useMessageSending } from '@/app/components/simple-messages-view/hooks/useMessageSending'
import { useOptimizedMessageState } from '@/app/hooks/useOptimizedMessageState'
import type { InstanceLog } from '@/app/components/simple-messages-view/types'

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

function Composer({ instanceId = 'instance', logs = [] }: { instanceId?: string; logs?: InstanceLog[] }) {
  const { message, setMessage, messageRef, handleMessageChange, clearMessage, textareaRef } = useOptimizedMessageState('', 'stream-composer-test')
  const logsRef = useRef(logs)
  useLayoutEffect(() => { logsRef.current = logs }, [logs])
  const { handleSendMessage } = useMessageSending({
    activeRobotInstance: { id: instanceId }, selectedActivity: 'ask', selectedContext: {} as any,
    skillSelection: { skill_mode: 'auto', skill_slugs: [] }, messageRef, logsRef, onClearMessage: clearMessage,
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
    activeRobotInstance={{ id: instanceId }}
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

  expect(textarea).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  expect(fetch).toHaveBeenCalledWith('/api/robots/instance/assistant', expect.objectContaining({
    method: 'POST', body: expect.stringContaining('Review this'),
  }))
  expect(textarea.value).toBe('Review this')
  expect(textarea).toBeDisabled()

  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from(': keepalive\n\n'), done: false })
  })
  expect(textarea).toBeDisabled()
  expect(textarea.value).toBe('Review this')

  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  const valueAfterAcceptance = textarea.value
  expect(textarea).toBeEnabled()
  expect(textarea).toHaveFocus()
  expect(window.localStorage.getItem('input-cache-stream-composer-test')).toBeNull()
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: completed\ndata: {"type":"completed","success":true}\n\n'), done: false })
  })
  expect(valueAfterAcceptance).toBe('')
  expect(toast).not.toHaveBeenCalled()
})

it('preserves a new draft written after acceptance while the assistant is still working', async () => {
  const pendingReads = mockAssistantStream()
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'First request' } })
  fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  expect(textarea).toBeDisabled()
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  expect(textarea.value).toBe('')
  expect(textarea).toBeEnabled()
  fireEvent.change(textarea, { target: { value: 'New draft' } })
  expect(textarea.value).toBe('New draft')
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
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
  expect(textarea).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
})

const incompleteMessage = 'Assistant execution paused before completion. Its progress is saved in this session.'

it.each([
  ['ASSISTANT_WORKFLOW_INCOMPLETE', 'Assistant status unconfirmed'],
  ['ASSISTANT_WORKFLOW_CONTINUING', 'Assistant is still working'],
  ['ASSISTANT_PRIVATE_CONTEXT_UNAVAILABLE', 'Assistant paused'],
])('does not show a generic error or resend after SSE %s', async (code, title) => {
  const pendingReads = mockAssistantStream()
  render(<Composer />)
  const textarea = screen.getByPlaceholderText('Type a message') as HTMLTextAreaElement
  fireEvent.change(textarea, { target: { value: 'First request' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  fireEvent.change(textarea, { target: { value: 'My next draft' } })
  await act(async () => {
    const error = { code, message: incompleteMessage }
    pendingReads.shift()!({ value: Buffer.from(`event: error\ndata: ${JSON.stringify({ success: false, error })}\n\n`), done: false })
  })
  expect(toast).toHaveBeenCalledTimes(1)
  expect(toast.mock.calls[0][0]).toMatchObject({ title })
  expect(toast.mock.calls[0][0]).not.toHaveProperty('variant', 'destructive')
  expect(textarea.value).toBe('My next draft')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each(['same turn', 'earlier turn', 'other instance', 'unmounted'])('scopes late SSE notices to the current turn: %s', async scenario => {
  const pendingReads = mockAssistantStream()
  const view = render(<Composer />)
  fireEvent.change(screen.getByPlaceholderText('Type a message'), { target: { value: 'Repeated text' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(pendingReads).toHaveLength(1))
  const { request_id } = JSON.parse((fetch as jest.Mock).mock.calls[0][1].body)
  await act(async () => {
    pendingReads.shift()!({ value: Buffer.from('event: accepted\ndata: {"type":"accepted","success":true}\n\n'), done: false })
  })
  if (scenario === 'unmounted') view.unmount()
  else view.rerender(<Composer instanceId={scenario === 'other instance' ? 'another-instance' : 'instance'} logs={[{
    id: 'saved', instance_id: 'instance', site_id: 'site', log_type: 'user_action', level: 'info',
    message: 'Repeated text', created_at: new Date().toISOString(),
    details: { status: 'completed', request_id: scenario === 'same turn' ? request_id : 'unrelated-request' },
  }]} />)
  await act(async () => {
    const error = { code: 'ASSISTANT_WORKFLOW_INCOMPLETE', message: incompleteMessage }
    pendingReads.shift()!({ value: Buffer.from(`event: error\ndata: ${JSON.stringify({ success: false, error })}\n\n`), done: false })
  })
  expect(toast).toHaveBeenCalledTimes(scenario === 'earlier turn' ? 1 : 0)
  expect(fetch).toHaveBeenCalledTimes(1)
})